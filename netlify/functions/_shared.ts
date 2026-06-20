import type { HandlerEvent, HandlerResponse } from '@netlify/functions';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { google } from 'googleapis';

export type EmployeeRole = 'admin' | 'accountant' | 'viewer';
export type EmployeeAccess = { role: EmployeeRole; is_active: boolean; safelisted: boolean };
export type BackendContext = { supabase: SupabaseClient; user: User; role: EmployeeRole };
export type AttachmentInput = { source: 'drive' | 'storage'; document_id?: string; path?: string; file_name?: string; mime_type?: string; size_bytes?: number };

export const json = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export function authorizeEmployee(access: EmployeeAccess, required: 'view' | 'operate' | 'admin' = 'operate') {
  const allowed = access.is_active && access.safelisted && (
    required === 'view' ||
    (required === 'operate' && (access.role === 'admin' || access.role === 'accountant')) ||
    (required === 'admin' && access.role === 'admin')
  );
  if (!allowed) throw Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'forbidden' });
}

export async function authenticate(event: HandlerEvent, required: 'view' | 'operate' | 'admin' = 'operate'): Promise<BackendContext> {
  const authHeader = event.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error('Supabase server configuration is missing'), { statusCode: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) throw Object.assign(new Error('Invalid session'), { statusCode: 401 });
  const { data: profile } = await supabase.from('profiles').select('email,is_active,role').eq('id', user.id).single();
  const { data: allowlist } = profile?.email
    ? await supabase.from('employee_email_allowlist').select('is_active,role').eq('email', String(profile.email).toLowerCase()).maybeSingle()
    : { data: null };
  const role = profile?.role as EmployeeRole | undefined;
  const safelisted = Boolean(allowlist?.is_active && allowlist.role === role);
  const access: EmployeeAccess = { role: role ?? 'viewer', is_active: Boolean(profile?.is_active), safelisted };
  authorizeEmployee(access, required);
  return { supabase, user, role: access.role };
}

export function parseBody<T>(event: HandlerEvent): T {
  try { return JSON.parse(event.body ?? '{}') as T; }
  catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }); }
}

export async function requireClientPeriod(supabase: SupabaseClient, clientId: string, f29PeriodId: string) {
  if (!clientId || !f29PeriodId) throw Object.assign(new Error('Client and F29 period are required'), { statusCode: 400 });
  const { data } = await supabase.from('f29_periods').select('id,client_id').eq('id', f29PeriodId).eq('client_id', clientId).maybeSingle();
  if (!data) throw Object.assign(new Error('F29 period does not belong to the client'), { statusCode: 404, code: 'client_period_mismatch' });
  return data;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function validateEmails(values: unknown, required = false): string[] {
  if (!Array.isArray(values)) throw Object.assign(new Error('Recipients must be an array'), { statusCode: 400 });
  const emails = [...new Set(values.map(value => String(value).trim().toLowerCase()).filter(Boolean))];
  if (required && !emails.length) throw Object.assign(new Error('At least one recipient is required'), { statusCode: 400 });
  if (emails.some(email => !EMAIL.test(email))) throw Object.assign(new Error('One or more email addresses are invalid'), { statusCode: 400 });
  return emails;
}

export function sanitizeHtml(value: string) {
  return value
    .replace(/<\s*(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

export function renderTemplate(value: string, variables: Record<string, string>) {
  return value.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key: string) => variables[key] ?? '—');
}

export async function resolveEmployeeEmail(supabase: SupabaseClient, profileId?: string | null, fullName?: string | null) {
  if (profileId) {
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', profileId).eq('is_active', true).maybeSingle();
    if (profile?.email) return String(profile.email);
    const { data: allowed } = await supabase.from('employee_email_allowlist').select('email').eq('profile_id', profileId).eq('is_active', true).maybeSingle();
    if (allowed?.email) return String(allowed.email);
  }
  if (fullName?.trim()) {
    const { data: profile } = await supabase.from('profiles').select('email').ilike('full_name', fullName.trim()).eq('is_active', true).maybeSingle();
    if (profile?.email) return String(profile.email);
    const { data: allowed } = await supabase.from('employee_email_allowlist').select('email').ilike('full_name', fullName.trim()).eq('is_active', true).maybeSingle();
    if (allowed?.email) return String(allowed.email);
  }
  return '';
}

export async function loadAttachments(event: HandlerEvent, supabase: SupabaseClient, inputs: AttachmentInput[], expectedClientId: string) {
  const output: Array<{ filename: string; content: string; content_type?: string; content_id?: string }> = [];
  let total = 0;
  for (const input of inputs) {
    let bytes: Uint8Array;
    let filename = input.file_name || 'archivo';
    let contentType = input.mime_type;
    if (input.source === 'storage') {
      if (!input.path || input.path.includes('..') || !input.path.startsWith(`${expectedClientId}/`)) throw Object.assign(new Error('Invalid storage attachment'), { statusCode: 400 });
      const { data, error } = await supabase.storage.from('email-attachments').download(input.path);
      if (error || !data) throw Object.assign(new Error(`Attachment unavailable: ${filename}`), { statusCode: 400 });
      bytes = new Uint8Array(await data.arrayBuffer());
      filename = input.file_name || input.path.split('/').pop() || filename;
      contentType ||= data.type;
    } else {
      if (!input.document_id) throw Object.assign(new Error('Drive document_id is required'), { statusCode: 400 });
      const { data: document } = await supabase.from('documents').select('client_id,drive_file_id,file_name,mime_type').eq('id', input.document_id).single();
      if (!document || document.client_id !== expectedClientId) throw Object.assign(new Error('Drive attachment not found'), { statusCode: 404 });
      const token = event.headers['x-google-access-token'];
      if (!token) throw Object.assign(new Error('Google Drive authorization is required for this attachment'), { statusCode: 401, code: 'drive_reauth_required' });
      const oauth = new google.auth.OAuth2();
      oauth.setCredentials({ access_token: token });
      const drive = google.drive({ version: 'v3', auth: oauth });
      try {
        if (document.mime_type === 'application/vnd.google-apps.spreadsheet') {
          const response = await drive.files.export({ fileId: document.drive_file_id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, { responseType: 'arraybuffer' });
          bytes = new Uint8Array(response.data as ArrayBuffer);
          filename = document.file_name.toLowerCase().endsWith('.xlsx') ? document.file_name : `${document.file_name}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else {
          const response = await drive.files.get({ fileId: document.drive_file_id, alt: 'media' }, { responseType: 'arraybuffer' });
          bytes = new Uint8Array(response.data as ArrayBuffer);
          filename = document.file_name;
          contentType = document.mime_type ?? undefined;
        }
      } catch {
        throw Object.assign(new Error(`No se pudo cargar o exportar el adjunto de Drive: ${document.file_name}. El correo no fue enviado.`), { statusCode: 400 });
      }
    }
    total += bytes.byteLength;
    if (total > 10 * 1024 * 1024) throw Object.assign(new Error('Attachments exceed the 10 MB combined limit'), { statusCode: 413 });
    output.push({ filename, content: Buffer.from(bytes).toString('base64'), content_type: contentType, ...(contentType?.startsWith('image/') ? { content_id: `proof-${output.length + 1}` } : {}) });
  }
  return output;
}

export async function sendWithResend(payload: { from: string; to: string[]; cc: string[]; subject: string; html: string; attachments: unknown[]; scheduled_at?: string; reply_to?: string }, idempotencyKey: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as { id?: string; message?: string };
  if (!response.ok || !result.id) throw new Error(result.message || 'Resend rejected the email');
  return result.id;
}

export function functionError(error: unknown) {
  const value = error as { message?: string; statusCode?: number; code?: string };
  return json(value.statusCode ?? 500, { error: value.message ?? 'Unexpected server error', ...(value.code ? { code: value.code } : {}) });
}
