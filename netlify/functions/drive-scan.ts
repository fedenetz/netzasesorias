import type { Handler, HandlerResponse } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_FULL_SCOPE = 'https://www.googleapis.com/auth/drive';

export const hasDriveReadScope = (scopes: string[]) => scopes.includes(DRIVE_READ_SCOPE) || scopes.includes(DRIVE_FULL_SCOPE);

const json = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const authHeader = event.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Supabase server configuration is missing' });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json(401, { error: 'Invalid session' });

  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', user.id).single();
  if (!profile?.is_active) return json(403, { error: 'Employee access required' });

  const googleAccessToken = event.headers['x-google-access-token'];
  if (!googleAccessToken) return json(401, { code: 'drive_reauth_required', error: 'Autoriza Google Drive nuevamente para continuar.' });

  const oauth = new google.auth.OAuth2();
  try {
    const tokenInfo = await oauth.getTokenInfo(googleAccessToken);
    if (tokenInfo.email && user.email && tokenInfo.email.toLowerCase() !== user.email.toLowerCase()) {
      return json(403, { error: 'La cuenta de Google Drive no coincide con el empleado autenticado.' });
    }
    if (!hasDriveReadScope(tokenInfo.scopes ?? [])) {
      return json(403, { code: 'drive_reauth_required', error: 'Google Drive no autorizó el permiso de lectura requerido.' });
    }
  } catch {
    return json(401, { code: 'drive_reauth_required', error: 'La autorización de Google Drive venció. Conecta tu cuenta nuevamente.' });
  }
  oauth.setCredentials({ access_token: googleAccessToken });

  let clientId = '';
  try { clientId = String(JSON.parse(event.body ?? '{}').client_id ?? ''); }
  catch { return json(400, { error: 'Invalid JSON body' }); }
  if (!clientId) return json(400, { error: 'client_id is required' });

  const { data: client, error: clientError } = await supabase.from('clients').select('id,drive_folder_id').eq('id', clientId).single();
  if (clientError || !client?.drive_folder_id) return json(404, { error: 'Client Drive folder not found' });

  const drive = google.drive({ version: 'v3', auth: oauth });
  let pageToken: string | undefined;
  const files: Array<{ id?: string | null; name?: string | null; mimeType?: string | null; modifiedTime?: string | null; webViewLink?: string | null; size?: string | null; md5Checksum?: string | null }> = [];
  try {
    do {
      const response = await drive.files.list({
        q: `'${client.drive_folder_id}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size,md5Checksum)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      files.push(...(response.data.files ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return json(401, { code: 'drive_reauth_required', error: 'La autorización de Google Drive venció. Conecta tu cuenta nuevamente.' });
    if (status === 403) return json(403, { error: 'Tu cuenta Google no tiene acceso a la carpeta Drive de este cliente.' });
    return json(502, { error: 'Google Drive no respondió correctamente.' });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const file of files) {
    if (!file.id || !file.name) continue;
    const { data: existing } = await supabase.from('documents').select('id').eq('drive_file_id', file.id).maybeSingle();
    const payload = {
      client_id: client.id,
      drive_file_id: file.id,
      file_name: file.name,
      mime_type: file.mimeType,
      modified_at: file.modifiedTime,
      drive_web_view_link: file.webViewLink,
      scanned_at: new Date().toISOString(),
      drive_metadata: { size: file.size, md5Checksum: file.md5Checksum },
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('documents').upsert(payload, { onConflict: 'drive_file_id' });
    if (error) errors.push(`${file.name}: ${error.message}`); else if (existing) updated++; else created++;
  }

  await supabase.from('activity_log').insert({ actor_id: user.id, client_id: clientId, action: 'drive_scan', entity_type: 'client', entity_id: clientId, after_data: { files_found: files.length, created, updated, errors: errors.length } });
  return json(errors.length ? 207 : 200, { files_found: files.length, new_files: created, updated_files: updated, errors });
};
