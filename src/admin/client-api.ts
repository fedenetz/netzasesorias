import { supabase } from './supabase';
import type { ActivityEntry, ClientBillingSummary, ClientDocument, ClientObservation, ClientRow, DocumentKind } from './types';
import { compareF29Documents, inferDocumentArea, inferOperationalDocumentKind, isF29Workbook } from './document-matching';

const profileName = (value: unknown) => Array.isArray(value) ? String(value[0]?.full_name ?? 'Sistema') : String((value as { full_name?: string } | null)?.full_name ?? 'Sistema');

export class DriveAuthorizationError extends Error {
  constructor(message = 'Conecta nuevamente tu cuenta Google para autorizar la lectura de Drive.') {
    super(message);
    this.name = 'DriveAuthorizationError';
  }
}

export async function loadClientDocuments(clientId: string): Promise<ClientDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('documents').select('id,drive_file_id,drive_web_view_link,file_name,mime_type,document_type,inferred_document_type,classification_source,processing_status,modified_at,drive_metadata').eq('client_id', clientId).order('modified_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(doc => {
    const metadata = doc.drive_metadata && typeof doc.drive_metadata === 'object' && !Array.isArray(doc.drive_metadata) ? doc.drive_metadata as Record<string, unknown> : {};
    const path = String(metadata.path ?? doc.file_name);
    const module = inferDocumentArea(path);
    const inferredType = inferOperationalDocumentKind({ name: doc.file_name, path, mimeType: doc.mime_type }) ?? doc.inferred_document_type;
    const type = doc.classification_source === 'manual' ? doc.document_type : inferredType ?? doc.document_type;
    return { id: doc.id, driveFileId: doc.drive_file_id, driveUrl: doc.drive_web_view_link, name: doc.file_name, mimeType: doc.mime_type, type, inferredType, classificationSource: doc.classification_source, processingStatus: doc.processing_status, modifiedAt: doc.modified_at, drivePath: path, depth: Number(metadata.depth ?? 1), module, isFolder: doc.mime_type === 'application/vnd.google-apps.folder' };
  });
}

export async function classifyDocument(id: string, type: DocumentKind) {
  if (!supabase) return;
  const { data: before, error: readError } = await supabase.from('documents').select('client_id,document_type,processing_status').eq('id', id).single();
  if (readError) throw readError;
  const processingStatus = type === 'other' ? 'unclassified' : 'classified';
  const { error } = await supabase.from('documents').update({ document_type: type, classification_source: 'manual', processing_status: processingStatus, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ actor_id: user?.id, client_id: before.client_id, action: 'document_classified', entity_type: 'document', entity_id: id, before_data: before, after_data: { document_type: type, classification_source: 'manual', processing_status: processingStatus } });
}

export async function scanClientDrive(clientId: string, period?: { year: number; month: number }) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('La sesión expiró.');
  if (!session.provider_token) throw new DriveAuthorizationError();
  const response = await fetch('/.netlify/functions/scan-drive-folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'X-Google-Access-Token': session.provider_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, ...(period ? { year: period.year, month: period.month, scope: 'period' } : {}) }),
  });
  const result = await response.json();
  if (result.code === 'drive_reauth_required') throw new DriveAuthorizationError(result.error);
  if (!response.ok && response.status !== 207) throw new Error(result.error ?? 'No fue posible escanear Drive.');
  return result as { items_found: number; files_found: number; folders_found: number; new_files: number; updated_files: number; max_depth: number; truncated: boolean; errors: string[] };
}

const EXCEL_EXTENSIONS = /\.(xls|xlsx|xlsm)$/i;
const EXCEL_MIMES = new Set(['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel.sheet.macroenabled.12', 'application/octet-stream']);

export async function uploadF29Excel(clientId: string, year: number, month: number, file: File) {
  if (!EXCEL_EXTENSIONS.test(file.name) || (file.type && !EXCEL_MIMES.has(file.type.toLowerCase()))) throw new Error('Selecciona un archivo Excel válido (.xls, .xlsx o .xlsm).');
  if (file.size > 15 * 1024 * 1024) throw new Error('El archivo supera el máximo de 15 MB.');
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.provider_token) throw new DriveAuthorizationError('Autoriza Google Drive para subir el archivo al período seleccionado.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = ''; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  const response = await fetch('/.netlify/functions/upload-f29-document', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'X-Google-Access-Token': session.provider_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId, year, month, file_name: file.name, mime_type: file.type || 'application/octet-stream', content_base64: btoa(binary) }) });
  const result = await response.json();
  if (result.code === 'drive_reauth_required') throw new DriveAuthorizationError(result.error);
  if (!response.ok) throw new Error(result.error ?? 'No fue posible subir el Excel a Drive.');
  return result as { document: { id: string; name: string; url: string | null } };
}

export async function loadF29PeriodDocument(clientId: string, year: number, month: number) {
  const documents = await loadClientDocuments(clientId);
  const document = documents
    .filter(item => isF29Workbook({ name: item.name, path: item.drivePath, mimeType: item.mimeType, modifiedAt: item.modifiedAt, isFolder: item.isFolder }, year, month))
    .sort((left, right) => compareF29Documents(
      { name: left.name, path: left.drivePath, mimeType: left.mimeType, modifiedAt: left.modifiedAt, isFolder: left.isFolder },
      { name: right.name, path: right.drivePath, mimeType: right.mimeType, modifiedAt: right.modifiedAt, isFolder: right.isFolder },
      year,
      month,
    ))[0];
  return document ? { id: document.id, name: document.name, url: document.driveUrl } : null;
}

export async function loadClientObservations(clientId: string): Promise<ClientObservation[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('observations').select('id,body,is_resolved,created_at,profiles!observations_created_by_fkey(full_name)').eq('client_id', clientId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(item => ({ id: item.id, body: item.body, resolved: item.is_resolved, createdAt: item.created_at, author: profileName(item.profiles) }));
}

export async function addClientObservation(clientId: string, body: string) {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('La sesión expiró.');
  const { data, error } = await supabase.from('observations').insert({ client_id: clientId, body, created_by: user.id }).select('id').single();
  if (error) throw error;
  await supabase.from('activity_log').insert({ actor_id: user.id, client_id: clientId, action: 'observation_added', entity_type: 'observation', entity_id: data.id, after_data: { body } });
}

export async function loadClientActivity(clientId: string): Promise<ActivityEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('activity_log').select('id,action,before_data,after_data,created_at,profiles!activity_log_actor_id_fkey(full_name)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(item => ({ id: item.id, action: item.action, beforeData: item.before_data, afterData: item.after_data, createdAt: item.created_at, actor: profileName(item.profiles) }));
}

export async function loadClientBillingSummary(clientId: string): Promise<ClientBillingSummary> {
  if (!supabase) return { debt: 0, status: 'not_applicable', lastPaymentAt: null, lastPaymentAmount: null, lastReminderAt: null, paymentLinkActive: false, serviceId: null, serviceName: 'Sin plan', subscribed: false };
  const [itemsResult, serviceResult] = await Promise.all([
    supabase.from('billing_items').select('amount,status,paid_at,last_reminder_at,payment_links(status)').eq('client_id', clientId).order('paid_at', { ascending: false, nullsFirst: false }),
    supabase.from('client_services').select('id,is_subscribed,plan_name,services(name)').eq('client_id', clientId).limit(1).maybeSingle(),
  ]);
  if (itemsResult.error) throw itemsResult.error; if (serviceResult.error) throw serviceResult.error;
  const items = itemsResult.data ?? []; const open = items.filter(item => !['paid','not_applicable'].includes(item.status)); const paid = items.find(item => item.status === 'paid' && item.paid_at); const service = serviceResult.data; const serviceData = Array.isArray(service?.services) ? service?.services[0] : service?.services;
  const status = open.some(item => item.status === 'overdue') ? 'overdue' : open[0]?.status ?? (paid ? 'paid' : 'not_applicable');
  return { debt: open.reduce((sum, item) => sum + Number(item.amount), 0), status, lastPaymentAt: paid?.paid_at ?? null, lastPaymentAmount: paid ? Number(paid.amount) : null, lastReminderAt: items.map(item => item.last_reminder_at).filter(Boolean).sort().reverse()[0] ?? null, paymentLinkActive: items.some(item => (item.payment_links ?? []).some(link => link.status === 'active')), serviceId: service?.id ?? null, serviceName: service?.plan_name || serviceData?.name || 'Sin plan', subscribed: service?.is_subscribed ?? false };
}

export async function loadServicePlans() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('services').select('id,name').eq('active', true).order('name');
  if (error) throw error; return data ?? [];
}

export async function updateClientPlan(clientId: string, clientServiceId: string | null, serviceId: string, subscribed: boolean) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const before = clientServiceId ? (await supabase.from('client_services').select('*').eq('id', clientServiceId).single()).data : null;
  const query = clientServiceId ? supabase.from('client_services').update({ service_id: serviceId, is_subscribed: subscribed, updated_at: new Date().toISOString() }).eq('id', clientServiceId) : supabase.from('client_services').insert({ client_id: clientId, service_id: serviceId, is_subscribed: subscribed });
  const { data, error } = await query.select('id').single(); if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ actor_id: user?.id, client_id: clientId, action: 'client_plan_updated', entity_type: 'client_service', entity_id: data.id, before_data: before, after_data: { service_id: serviceId, is_subscribed: subscribed } });
  return data.id as string;
}

export async function saveClient(client: Partial<ClientRow> & Pick<ClientRow, 'rut' | 'name'>, id?: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  if (client.legalRepresentativeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.legalRepresentativeEmail)) throw new Error('El email del representante legal no es válido.');
  const values = { rut: client.rut, legal_name: client.name, accounting_code: client.accountingCode || null, drive_folder_id: client.driveFolderId || null, tax_regime: client.taxRegime || null, legal_type: client.legalType || null, legal_representative_email: client.legalRepresentativeEmail || null, economic_activity: client.economicActivity || null, address: client.address || null, phone: client.phone || null, bank_name: client.bankName || null, checking_account: client.checkingAccount || null, accounting_type: client.accountingType || null, is_active: client.isActive ?? true, updated_at: new Date().toISOString() };
  const query = id ? supabase.from('clients').update(values).eq('id', id) : supabase.from('clients').insert(values);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ actor_id: user?.id, client_id: data.id, action: id ? 'client_updated' : 'client_created', entity_type: 'client', entity_id: data.id, after_data: values });
  return data.id as string;
}
