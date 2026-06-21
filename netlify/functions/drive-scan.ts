import type { Handler, HandlerResponse } from '@netlify/functions';
import { google } from 'googleapis';
import { authenticate, functionError } from './_shared';
import { inferDocumentArea, inferOperationalDocumentKind, isF29Workbook, pathMatchesMonthlyPeriod } from '../../src/admin/document-matching';
import { ensureF29LoadedStatus } from './_f29-document-status';

const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_FULL_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MAX_ITEMS = 10000;
const MAX_DEPTH = 15;
const FOLDER_BATCH_SIZE = 8;

export const hasDriveReadScope = (scopes: string[]) => scopes.includes(DRIVE_READ_SCOPE) || scopes.includes(DRIVE_FULL_SCOPE);

export const inferDriveModule = (path: string): 'f29' | 'f22' | 'other' => {
  return inferDocumentArea(path);
};

type DocumentKind = 'f29' | 'rcv' | 'bce' | 'f22' | 'dj_1948' | 'dj_1949' | 'excel' | 'pdf' | 'certificate' | 'receipt' | 'contract' | 'other';
export const inferDocumentType = (name: string, path: string, mimeType: string | null): DocumentKind => {
  const value = `${path}/${name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const operationalKind = inferOperationalDocumentKind({ name, path, mimeType });
  if (operationalKind) return operationalKind;
  if (/(^|[^a-z0-9])rcv([^a-z0-9]|$)|registro.*compra.*venta/.test(value)) return 'rcv';
  if (/dj.?1948/.test(value)) return 'dj_1948';
  if (/dj.?1949/.test(value)) return 'dj_1949';
  if (/certificad/.test(value)) return 'certificate';
  if (/contrato|mandato|anexo/.test(value)) return 'contract';
  if (/comprobante|recibo|pago|transferencia/.test(value)) return 'receipt';
  if (/\.(xls|xlsx|xlsm)$/i.test(name) || /spreadsheet|excel/.test(mimeType ?? '')) return 'excel';
  if (/\.pdf$/i.test(name) || mimeType === 'application/pdf') return 'pdf';
  return 'other';
};

const periodPathMatches = (path: string, year: number, month: number) => {
  return pathMatchesMonthlyPeriod(path, year, month) && inferDocumentArea(path) === 'f29';
};

const isRelevantPeriodWorkbook = (item: { name: string; path: string; mimeType: string | null; isFolder: boolean }, year: number, month: number) => item.isFolder || isF29Workbook(item, year, month);

const json = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let context: Awaited<ReturnType<typeof authenticate>>;
  try { context = await authenticate(event); }
  catch (error) { return functionError(error); }
  const { supabase, user } = context;

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

  let clientId = ''; let scope = ''; let year = 0; let month = 0;
  try { const input = JSON.parse(event.body ?? '{}'); clientId = String(input.client_id ?? ''); scope = String(input.scope ?? ''); year = Number(input.year ?? 0); month = Number(input.month ?? 0); }
  catch { return json(400, { error: 'Invalid JSON body' }); }
  if (!clientId) return json(400, { error: 'client_id is required' });

  const { data: client, error: clientError } = await supabase.from('clients').select('id,drive_folder_id').eq('id', clientId).single();
  if (clientError || !client?.drive_folder_id) return json(404, { error: 'Client Drive folder not found' });

  const drive = google.drive({ version: 'v3', auth: oauth });
  type DriveItem = { id: string; name: string; mimeType: string | null; modifiedTime: string | null; webViewLink: string | null; size: string | null; md5Checksum: string | null; path: string; parentFolderId: string; depth: number; module: 'f29' | 'f22' | 'other'; isFolder: boolean };
  type FolderQueueItem = { id: string; path: string; depth: number };
  const items: DriveItem[] = [];
  let scanRoot: FolderQueueItem = { id: client.drive_folder_id, path: '', depth: 0 };
  const discoverPeriodFolder = async () => {
    let folders: FolderQueueItem[] = [{ id: client.drive_folder_id, path: '', depth: 0 }];
    for (let depth = 0; depth < MAX_DEPTH && folders.length; depth++) {
      const next: FolderQueueItem[] = [];
      for (let index = 0; index < folders.length; index += FOLDER_BATCH_SIZE) {
        const batches = await Promise.all(folders.slice(index, index + FOLDER_BATCH_SIZE).map(async folder => {
          const response = await drive.files.list({ q: `'${folder.id}' in parents and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`, fields: 'files(id,name)', pageSize: 1000, supportsAllDrives: true, includeItemsFromAllDrives: true });
          return (response.data.files ?? []).filter(file => file.id && file.name).map(file => ({ id: file.id!, path: folder.path ? `${folder.path}/${file.name}` : file.name!, depth: folder.depth + 1 }));
        }));
        for (const batch of batches) for (const folder of batch) { if (periodPathMatches(folder.path, year, month)) return folder; next.push(folder); }
      }
      folders = next;
    }
    return null;
  };
  if (scope === 'period') {
    if (!year || month < 1 || month > 12) return json(400, { error: 'A valid year and month are required for a period scan.' });
    const { data: folders } = await supabase.from('documents').select('drive_file_id,drive_metadata').eq('client_id', clientId).eq('mime_type', FOLDER_MIME_TYPE);
    const match = (folders ?? []).map(folder => ({ id: folder.drive_file_id, metadata: folder.drive_metadata as Record<string, unknown> })).filter(folder => periodPathMatches(String(folder.metadata?.path ?? ''), year, month)).sort((a, b) => String(b.metadata?.path ?? '').length - String(a.metadata?.path ?? '').length)[0];
    const discovered = match ? null : await discoverPeriodFolder();
    if (!match && !discovered) return json(404, { error: `No se encontró la carpeta F29 para ${String(month).padStart(2, '0')}/${year} dentro del Drive del cliente.` });
    scanRoot = match ? { id: match.id, path: String(match.metadata?.path ?? ''), depth: Number(match.metadata?.depth ?? 0) } : discovered!;
  }
  const visitedFolders = new Set<string>([scanRoot.id]);
  let frontier: FolderQueueItem[] = [scanRoot];
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
  const manualTypes = new Map<string, DocumentKind>();
  for (let index = 0; index < items.length; index += 200) {
    const ids = items.slice(index, index + 200).map(item => item.id);
    const { data, error } = await supabase.from('documents').select('drive_file_id,document_type,classification_source').in('drive_file_id', ids);
    if (error) errors.push(`Lectura de existentes: ${error.message}`);
    else for (const row of data ?? []) { existingIds.add(row.drive_file_id); if (row.classification_source === 'manual') manualTypes.set(row.drive_file_id, row.document_type as DocumentKind); }
  }
  const scannedAt = new Date().toISOString();
  for (let index = 0; index < items.length; index += 500) {
    const batch = items.slice(index, index + 500).filter(item => scope !== 'period' || isRelevantPeriodWorkbook(item, year, month));
    const payload = batch.map(item => { const inferred = item.isFolder ? 'other' : inferDocumentType(item.name, item.path, item.mimeType); const manual = manualTypes.get(item.id); return ({ client_id: client.id, drive_file_id: item.id, file_name: item.name, mime_type: item.mimeType, modified_at: item.modifiedTime, drive_web_view_link: item.webViewLink, document_type: manual ?? inferred, inferred_document_type: inferred, classification_source: manual ? 'manual' : 'inferred', processing_status: inferred === 'other' && !manual ? 'unclassified' : 'classified', scanned_at: scannedAt, drive_metadata: { size: item.size, md5Checksum: item.md5Checksum, path: item.path, parent_folder_id: item.parentFolderId, depth: item.depth, module: item.module, is_folder: item.isFolder }, updated_at: scannedAt }); });
    const { error } = await supabase.from('documents').upsert(payload, { onConflict: 'drive_file_id' });
    if (error) errors.push(`Lote ${Math.floor(index / 500) + 1}: ${error.message}`);
    else for (const item of batch) existingIds.has(item.id) ? updated++ : created++;
  }

  const filesFound = items.filter(item => !item.isFolder).length;
  const periodWorkbooks = scope === 'period' ? items.filter(item => isF29Workbook(item, year, month)) : [];
  const foldersFound = items.length - filesFound;
  const maxDepth = items.reduce((max, item) => Math.max(max, item.depth), 0);
  if (scope !== 'period') await supabase.from('clients').update({ last_drive_scan_at: scannedAt, updated_at: scannedAt }).eq('id', clientId);
  if (periodWorkbooks.length && created + updated > 0) await ensureF29LoadedStatus({ supabase, actorId: user.id, clientId, year, month, source: 'drive_scan' });
  await supabase.from('activity_log').insert({ actor_id: user.id, client_id: clientId, action: scope === 'period' ? 'f29_period_drive_scan' : 'drive_scan', entity_type: scope === 'period' ? 'f29_folder' : 'client', entity_id: scope === 'period' ? `${year}-${String(month).padStart(2, '0')}` : clientId, after_data: { year: year || null, month: month || null, folder_path: scanRoot.path || null, items_found: items.length, files_found: filesFound, folders_found: foldersFound, max_depth: maxDepth, truncated, created, updated, errors: errors.length } });
  return json(errors.length ? 207 : 200, { items_found: items.length, files_found: filesFound, folders_found: foldersFound, new_files: created, updated_files: updated, max_depth: maxDepth, truncated, errors });
};
