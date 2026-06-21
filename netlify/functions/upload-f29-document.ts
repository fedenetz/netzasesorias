import type { Handler, HandlerResponse } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { inferDocumentType } from './drive-scan';
import { authenticate, functionError } from './_shared';
import { inferDocumentArea, pathMatchesMonthlyPeriod } from '../../src/admin/document-matching';
import { ensureF29LoadedStatus } from './_f29-document-status';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const EXCEL_MIMES = new Set(['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel.sheet.macroenabled.12', 'application/octet-stream']);
const json = (statusCode: number, body: Record<string, unknown>): HandlerResponse => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const periodMatch = (path: string, year: number, month: number) => {
  return pathMatchesMonthlyPeriod(path, year, month) && inferDocumentArea(path) === 'f29';
};

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let context: Awaited<ReturnType<typeof authenticate>>;
  try { context = await authenticate(event); }
  catch (error) { return functionError(error); }
  const { supabase, user } = context;

  let input: { client_id?: string; year?: number; month?: number; file_name?: string; mime_type?: string; content_base64?: string };
  try { input = JSON.parse(event.body ?? '{}'); } catch { return json(400, { error: 'Invalid JSON body' }); }
  const clientId = String(input.client_id ?? ''); const year = Number(input.year); const month = Number(input.month); const name = String(input.file_name ?? ''); const mime = String(input.mime_type ?? '').toLowerCase();
  if (!clientId || !year || month < 1 || month > 12) return json(400, { error: 'Cliente y período son obligatorios.' });
  if (!/\.(xls|xlsx|xlsm)$/i.test(name) || (mime && !EXCEL_MIMES.has(mime))) return json(415, { error: 'Solo se permiten archivos Excel .xls, .xlsx o .xlsm.' });
  const buffer = Buffer.from(String(input.content_base64 ?? ''), 'base64');
  if (!buffer.length || buffer.length > 15 * 1024 * 1024) return json(413, { error: 'El archivo debe tener contenido y no superar 15 MB.' });

  const googleToken = event.headers['x-google-access-token'];
  if (!googleToken) return json(401, { code: 'drive_reauth_required', error: 'Autoriza Google Drive para subir archivos.' });
  const oauth = new google.auth.OAuth2();
  try {
    const info = await oauth.getTokenInfo(googleToken);
    if (!info.scopes?.includes(DRIVE_SCOPE)) return json(403, { code: 'drive_reauth_required', error: 'Vuelve a autorizar Google Drive con permiso para subir archivos.' });
    if (info.email && user.email && info.email.toLowerCase() !== user.email.toLowerCase()) return json(403, { error: 'La cuenta Google no coincide con el empleado autenticado.' });
  } catch { return json(401, { code: 'drive_reauth_required', error: 'La autorización de Google Drive venció.' }); }
  oauth.setCredentials({ access_token: googleToken });

  const { data: folders } = await supabase.from('documents').select('drive_file_id,drive_metadata').eq('client_id', clientId).eq('mime_type', FOLDER_MIME);
  const folder = (folders ?? []).map(item => ({ id: item.drive_file_id, metadata: item.drive_metadata as Record<string, unknown> })).filter(item => periodMatch(String(item.metadata?.path ?? ''), year, month)).sort((a, b) => String(b.metadata?.path ?? '').length - String(a.metadata?.path ?? '').length)[0];
  if (!folder) return json(404, { error: `No se encontró la carpeta de F29 para ${String(month).padStart(2, '0')}/${year}. Escanea primero el Drive del cliente.` });

  try {
    const drive = google.drive({ version: 'v3', auth: oauth });
    const created = await drive.files.create({ requestBody: { name, parents: [folder.id] }, media: { mimeType: mime || 'application/octet-stream', body: Readable.from(buffer) }, fields: 'id,name,mimeType,modifiedTime,webViewLink,size,md5Checksum', supportsAllDrives: true });
    if (!created.data.id) throw new Error('Drive did not return a file id');
    const now = new Date().toISOString(); const path = `${String(folder.metadata?.path ?? '')}/${name}`.replace(/^\//, ''); const inferred = inferDocumentType(name, path, created.data.mimeType ?? mime);
    const { data: document, error } = await supabase.from('documents').upsert({ client_id: clientId, drive_file_id: created.data.id, file_name: created.data.name ?? name, mime_type: created.data.mimeType ?? mime, drive_web_view_link: created.data.webViewLink, modified_at: created.data.modifiedTime ?? now, document_type: inferred, inferred_document_type: inferred, classification_source: 'inferred', processing_status: 'classified', scanned_at: now, drive_metadata: { path, parent_folder_id: folder.id, depth: Number(folder.metadata?.depth ?? 0) + 1, module: 'f29', size: created.data.size, md5Checksum: created.data.md5Checksum }, updated_at: now }, { onConflict: 'drive_file_id' }).select('id,file_name,drive_web_view_link').single();
    if (error || !document) throw error ?? new Error('No se pudo indexar el archivo subido.');
    await ensureF29LoadedStatus({ supabase, actorId: user.id, clientId, year, month, source: 'direct_upload', documentId: document.id });
    await supabase.from('activity_log').insert({ actor_id: user.id, client_id: clientId, action: 'f29_document_uploaded', entity_type: 'document', entity_id: document.id, after_data: { year, month, file_name: document.file_name, folder_path: folder.metadata?.path, drive_file_id: created.data.id } });
    return json(201, { document: { id: document.id, name: document.file_name, url: document.drive_web_view_link } });
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return json(401, { code: 'drive_reauth_required', error: 'La autorización de Google Drive venció.' });
    if (status === 403) return json(403, { error: 'La cuenta Google no puede escribir en la carpeta del período.' });
    return json(502, { error: error instanceof Error ? error.message : 'Google Drive no pudo guardar el archivo.' });
  }
};
