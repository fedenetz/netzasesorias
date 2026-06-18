import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  const authHeader = event.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const token = authHeader.slice(7);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) };

  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', user.id).single();
  if (!profile?.is_active) return { statusCode: 403, body: JSON.stringify({ error: 'Employee access required' }) };

  const { client_id } = JSON.parse(event.body ?? '{}');
  if (!client_id) return { statusCode: 400, body: JSON.stringify({ error: 'client_id is required' }) };
  const { data: client, error: clientError } = await supabase.from('clients').select('id, drive_folder_id').eq('id', client_id).single();
  if (clientError || !client?.drive_folder_id) return { statusCode: 404, body: JSON.stringify({ error: 'Client Drive folder not found' }) };

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });
  let pageToken: string | undefined;
  const files: Array<{ id?: string | null; name?: string | null; mimeType?: string | null; modifiedTime?: string | null; webViewLink?: string | null; size?: string | null; md5Checksum?: string | null }> = [];
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

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const file of files) {
    if (!file.id || !file.name) continue;
    const { data: existing } = await supabase.from('documents').select('id').eq('drive_file_id', file.id).maybeSingle();
    const payload = {
      client_id: client.id, drive_file_id: file.id, file_name: file.name, mime_type: file.mimeType,
      modified_at: file.modifiedTime, drive_web_view_link: file.webViewLink, scanned_at: new Date().toISOString(),
      drive_metadata: { size: file.size, md5Checksum: file.md5Checksum }, updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('documents').upsert(payload, { onConflict: 'drive_file_id' });
    if (error) errors.push(`${file.name}: ${error.message}`); else if (existing) updated++; else created++;
  }

  await supabase.from('activity_log').insert({ actor_id: user.id, client_id, action: 'drive_scan', entity_type: 'client', entity_id: client_id, after_data: { files_found: files.length, created, updated, errors: errors.length } });
  return { statusCode: errors.length ? 207 : 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files_found: files.length, new_files: created, updated_files: updated, errors }) };
};
