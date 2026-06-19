import type { Handler, HandlerResponse } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_FULL_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAX_ITEMS = 10000;
const MAX_DEPTH = 15;
const FOLDER_BATCH_SIZE = 8;

export const hasDriveReadScope = (scopes: string[]) => scopes.includes(DRIVE_READ_SCOPE) || scopes.includes(DRIVE_FULL_SCOPE);

export const inferDriveModule = (path: string): 'f29' | 'f22' | 'other' => {
  const normalized = path.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/(^|\/)impuestos?(\/|$)/.test(normalized)) return 'f29';
  if (/(^|\/)renta(\/|$)/.test(normalized)) return 'f22';
  return 'other';
};

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
  type DriveItem = { id: string; name: string; mimeType: string | null; modifiedTime: string | null; webViewLink: string | null; size: string | null; md5Checksum: string | null; path: string; parentFolderId: string; depth: number; module: 'f29' | 'f22' | 'other'; isFolder: boolean };
  type FolderQueueItem = { id: string; path: string; depth: number };
  const items: DriveItem[] = [];
  const visitedFolders = new Set<string>([client.drive_folder_id]);
  let frontier: FolderQueueItem[] = [{ id: client.drive_folder_id, path: '', depth: 0 }];
  let truncated = false;

  const listChildren = async (folder: FolderQueueItem) => {
    const children: DriveItem[] = [];
    let pageToken: string | undefined;
    do {
      const response = await drive.files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size,md5Checksum)',
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const file of response.data.files ?? []) {
        if (!file.id || !file.name) continue;
        const path = folder.path ? `${folder.path}/${file.name}` : file.name;
        children.push({ id: file.id, name: file.name, mimeType: file.mimeType ?? null, modifiedTime: file.modifiedTime ?? null, webViewLink: file.webViewLink ?? null, size: file.size ?? null, md5Checksum: file.md5Checksum ?? null, path, parentFolderId: folder.id, depth: folder.depth + 1, module: inferDriveModule(path), isFolder: file.mimeType === FOLDER_MIME_TYPE });
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken && items.length + children.length < MAX_ITEMS);
    return children;
  };

  try {
    while (frontier.length && items.length < MAX_ITEMS) {
      const nextFrontier: FolderQueueItem[] = [];
      for (let index = 0; index < frontier.length && items.length < MAX_ITEMS; index += FOLDER_BATCH_SIZE) {
        const batches = await Promise.all(frontier.slice(index, index + FOLDER_BATCH_SIZE).map(listChildren));
        for (const children of batches) {
          for (const child of children) {
            if (items.length >= MAX_ITEMS) { truncated = true; break; }
            items.push(child);
            if (child.isFolder && child.depth < MAX_DEPTH && !visitedFolders.has(child.id)) {
              visitedFolders.add(child.id);
              nextFrontier.push({ id: child.id, path: child.path, depth: child.depth });
            } else if (child.isFolder && child.depth >= MAX_DEPTH) truncated = true;
          }
        }
      }
      frontier = nextFrontier;
    }
    if (frontier.length) truncated = true;
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return json(401, { code: 'drive_reauth_required', error: 'La autorización de Google Drive venció. Conecta tu cuenta nuevamente.' });
    if (status === 403) return json(403, { error: 'Tu cuenta Google no tiene acceso a la carpeta Drive de este cliente.' });
    return json(502, { error: 'Google Drive no respondió correctamente.' });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const existingIds = new Set<string>();
  for (let index = 0; index < items.length; index += 200) {
    const ids = items.slice(index, index + 200).map(item => item.id);
    const { data, error } = await supabase.from('documents').select('drive_file_id').in('drive_file_id', ids);
    if (error) errors.push(`Lectura de existentes: ${error.message}`);
    else for (const row of data ?? []) existingIds.add(row.drive_file_id);
  }
  const scannedAt = new Date().toISOString();
  for (let index = 0; index < items.length; index += 500) {
    const batch = items.slice(index, index + 500);
    const payload = batch.map(item => ({ client_id: client.id, drive_file_id: item.id, file_name: item.name, mime_type: item.mimeType, modified_at: item.modifiedTime, drive_web_view_link: item.webViewLink, scanned_at: scannedAt, drive_metadata: { size: item.size, md5Checksum: item.md5Checksum, path: item.path, parent_folder_id: item.parentFolderId, depth: item.depth, module: item.module, is_folder: item.isFolder }, updated_at: scannedAt }));
    const { error } = await supabase.from('documents').upsert(payload, { onConflict: 'drive_file_id' });
    if (error) errors.push(`Lote ${Math.floor(index / 500) + 1}: ${error.message}`);
    else for (const item of batch) existingIds.has(item.id) ? updated++ : created++;
  }

  const filesFound = items.filter(item => !item.isFolder).length;
  const foldersFound = items.length - filesFound;
  const maxDepth = items.reduce((max, item) => Math.max(max, item.depth), 0);
  await supabase.from('activity_log').insert({ actor_id: user.id, client_id: clientId, action: 'drive_scan', entity_type: 'client', entity_id: clientId, after_data: { items_found: items.length, files_found: filesFound, folders_found: foldersFound, max_depth: maxDepth, truncated, created, updated, errors: errors.length } });
  return json(errors.length ? 207 : 200, { items_found: items.length, files_found: filesFound, folders_found: foldersFound, new_files: created, updated_files: updated, max_depth: maxDepth, truncated, errors });
};
