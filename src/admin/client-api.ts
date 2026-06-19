import { supabase } from './supabase';
import type { ActivityEntry, ClientDocument, ClientObservation, ClientRow, DocumentKind } from './types';

const profileName = (value: unknown) => Array.isArray(value) ? String(value[0]?.full_name ?? 'Sistema') : String((value as { full_name?: string } | null)?.full_name ?? 'Sistema');

export class DriveAuthorizationError extends Error {
  constructor(message = 'Conecta nuevamente tu cuenta Google para autorizar la lectura de Drive.') {
    super(message);
    this.name = 'DriveAuthorizationError';
  }
}

export async function loadClientDocuments(clientId: string): Promise<ClientDocument[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('documents').select('id,drive_file_id,drive_web_view_link,file_name,mime_type,document_type,processing_status,modified_at,drive_metadata').eq('client_id', clientId).order('modified_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(doc => {
    const metadata = doc.drive_metadata && typeof doc.drive_metadata === 'object' && !Array.isArray(doc.drive_metadata) ? doc.drive_metadata as Record<string, unknown> : {};
    const module = metadata.module === 'f29' || metadata.module === 'f22' ? metadata.module : 'other';
    return { id: doc.id, driveFileId: doc.drive_file_id, driveUrl: doc.drive_web_view_link, name: doc.file_name, mimeType: doc.mime_type, type: doc.document_type, processingStatus: doc.processing_status, modifiedAt: doc.modified_at, drivePath: String(metadata.path ?? doc.file_name), depth: Number(metadata.depth ?? 1), module, isFolder: doc.mime_type === 'application/vnd.google-apps.folder' };
  });
}

export async function classifyDocument(id: string, type: DocumentKind) {
  if (!supabase) return;
  const { data: before, error: readError } = await supabase.from('documents').select('client_id,document_type,processing_status').eq('id', id).single();
  if (readError) throw readError;
  const processingStatus = type === 'other' ? 'unclassified' : 'classified';
  const { error } = await supabase.from('documents').update({ document_type: type, processing_status: processingStatus, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ actor_id: user?.id, client_id: before.client_id, action: 'document_classified', entity_type: 'document', entity_id: id, before_data: before, after_data: { document_type: type, processing_status: processingStatus } });
}

export async function scanClientDrive(clientId: string) {
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
    body: JSON.stringify({ client_id: clientId }),
  });
  const result = await response.json();
  if (result.code === 'drive_reauth_required') throw new DriveAuthorizationError(result.error);
  if (!response.ok && response.status !== 207) throw new Error(result.error ?? 'No fue posible escanear Drive.');
  return result as { items_found: number; files_found: number; folders_found: number; new_files: number; updated_files: number; max_depth: number; truncated: boolean; errors: string[] };
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

export async function saveClient(client: Partial<ClientRow> & Pick<ClientRow, 'rut' | 'name'>, id?: string) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const values = { rut: client.rut, legal_name: client.name, accounting_code: client.accountingCode || null, drive_folder_id: client.driveFolderId || null, is_active: client.isActive ?? true, updated_at: new Date().toISOString() };
  const query = id ? supabase.from('clients').update(values).eq('id', id) : supabase.from('clients').insert(values);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ actor_id: user?.id, client_id: data.id, action: id ? 'client_updated' : 'client_created', entity_type: 'client', entity_id: data.id, after_data: values });
  return data.id as string;
}
