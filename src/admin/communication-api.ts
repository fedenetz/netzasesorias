import { supabase } from './supabase';
import type { ClientContact, ClientDocument, EmailAttachment, EmailTemplate } from './types';

const isLocalPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview');

async function sessionHeaders(includeGoogle = false) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('La sesión expiró.');
  return { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', ...(includeGoogle && session.provider_token ? { 'X-Google-Access-Token': session.provider_token } : {}) };
}

async function invoke(name: string, body: Record<string, unknown>, includeGoogle = false) {
  const response = await fetch(`/.netlify/functions/${name}`, { method: 'POST', headers: await sessionHeaders(includeGoogle), body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error ?? 'No fue posible completar la acción.'), { code: result.code });
  return result;
}

export async function loadClientContacts(clientId: string): Promise<ClientContact[]> {
  if (!supabase || isLocalPreview) return [];
  const { data, error } = await supabase.from('client_contacts').select('*').eq('client_id', clientId).order('is_primary', { ascending: false }).order('name');
  if (error) throw error;
  return (data ?? []).map(item => ({ id: item.id, clientId: item.client_id, name: item.name, email: item.email, contactType: item.contact_type, isBilling: item.is_billing, isPrimary: item.is_primary, isActive: item.is_active }));
}

export async function saveClientContact(contact: Omit<ClientContact, 'id'> & { id?: string }) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('save_client_contact', { p_client_id: contact.clientId, p_id: contact.id ?? null, p_name: contact.name, p_email: contact.email, p_contact_type: contact.contactType, p_is_billing: contact.isBilling, p_is_primary: contact.isPrimary, p_is_active: contact.isActive });
  if (error) throw error;
}

export async function loadEmailTemplate(key: string): Promise<EmailTemplate> {
  if (!supabase || isLocalPreview) return key === 'f29_payment_reminder'
    ? { id: 'preview-f29-reminder', key, subject: 'Recordatorio pago F29 {{month_name}} {{year}} - {{client_name}}', bodyHtml: '<p>Estimado/a {{client_name}},</p><p>Le recordamos que se encuentra pendiente el pago de su Formulario 29 de <strong>{{month_name}} {{year}}</strong>.</p><p>Monto F29: <strong>{{amount}}</strong></p><p>Saludos cordiales,<br>{{firm_name}}</p>' }
    : key === 'payment_reminder'
    ? { id: 'preview-reminder', key, subject: 'Recordatorio de pago - {{service_period}} - {{client_name}}', bodyHtml: '<p>Estimado/a {{client_name}},</p><p>Le recordamos el pago pendiente de <strong>{{billing_amount}}</strong>, con vencimiento {{due_date}}.</p><p>Saludos cordiales,<br>{{firm_name}}</p>' }
    : { id: 'preview-f29', key, subject: 'Formulario 29 {{month_name}} {{year}} - {{client_name}}', bodyHtml: '<p>Estimado/a {{client_name}},</p><p>Adjuntamos el resumen de su Formulario 29 de <strong>{{month_name}} {{year}}</strong>.</p><p>Monto declarado: <strong>{{amount}}</strong><br>Estado: {{payment_status}}</p><p>Saludos cordiales,<br>{{firm_name}}</p>' };
  const { data, error } = await supabase.from('email_templates').select('id,key,subject,body_html').eq('key', key).eq('active', true).single();
  if (error) throw error;
  return { id: data.id, key: data.key, subject: data.subject, bodyHtml: data.body_html };
}

export async function loadLastEmailRecipients(clientId: string, messageKind: 'f29_summary' | 'f29_payment_reminder' = 'f29_summary'): Promise<string[]> {
  if (!supabase || isLocalPreview) return [];
  const { data, error } = await supabase.from('email_logs').select('to_emails').eq('client_id', clientId).eq('message_kind', messageKind).eq('status', 'sent').order('sent_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data?.to_emails ?? [];
}

export async function loadStoredAttachments(periodId: string): Promise<EmailAttachment[]> {
  if (!supabase || isLocalPreview) return [];
  const { data, error } = await supabase.from('communication_files').select('id,source,storage_path,file_name,mime_type,size_bytes,document_id').eq('f29_period_id', periodId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(item => ({ id: item.id, source: item.source, documentId: item.document_id ?? undefined, path: item.storage_path ?? undefined, fileName: item.file_name, mimeType: item.mime_type ?? undefined, sizeBytes: item.size_bytes ? Number(item.size_bytes) : undefined }));
}

export async function uploadEmailAttachment(clientId: string, periodId: string, file: File): Promise<EmailAttachment> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const prepared = await invoke('prepare-email-attachment', { client_id: clientId, f29_period_id: periodId, file_name: file.name, mime_type: file.type, size_bytes: file.size });
  const { error } = await supabase.storage.from('email-attachments').uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
  if (error) throw error;
  const registered = await invoke('register-email-attachment', { client_id: clientId, f29_period_id: periodId, path: prepared.path, file_name: file.name, mime_type: file.type, size_bytes: file.size });
  const item = registered.attachment;
  return { id: item.id, source: 'storage', path: item.storage_path, fileName: item.file_name, mimeType: item.mime_type, sizeBytes: Number(item.size_bytes) };
}

export const driveAttachment = (document: ClientDocument): EmailAttachment => ({ source: 'drive', documentId: document.id, fileName: document.name, mimeType: document.mimeType ?? undefined });

export async function resolveEmployeeDirectoryEmail(fullName: string): Promise<string> {
  const result = await invoke('resolve-employee-email', { full_name: fullName });
  return String(result.email ?? '');
}

export const sendF29Email = (periodId: string, to: string[], cc: string[], subject: string, bodyHtml: string, attachments: EmailAttachment[], scheduleNextBusinessMorning = false) => invoke('send-email', { f29_period_id: periodId, to, cc, subject, body_html: bodyHtml, attachments: attachments.map(item => ({ source: item.source, document_id: item.documentId, path: item.path, file_name: item.fileName, mime_type: item.mimeType })), schedule_next_business_morning: scheduleNextBusinessMorning }, true);
export const sendReminder = (billingItemId: string, to: string[], cc: string[], subject: string, bodyHtml: string) => invoke('send-reminder', { billing_item_id: billingItemId, to, cc, subject, body_html: bodyHtml });
export const sendF29PaymentReminder = (periodId: string, to: string[], cc: string[], subject: string, bodyHtml: string) => invoke('send-reminder', { f29_period_id: periodId, to, cc, subject, body_html: bodyHtml });
