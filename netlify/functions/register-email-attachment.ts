import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody } from './_shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, user } = await authenticate(event);
    const input = parseBody<{ client_id: string; f29_period_id: string; path: string; file_name: string; mime_type: string; size_bytes: number }>(event);
    if (!input.path.startsWith(`${input.client_id}/${input.f29_period_id}/`) || input.path.includes('..')) throw Object.assign(new Error('Invalid attachment path'), { statusCode: 400 });
    const { data: files } = await supabase.storage.from('email-attachments').list(input.path.split('/').slice(0, -1).join('/'), { search: input.path.split('/').pop() });
    if (!files?.some(file => input.path.endsWith(`/${file.name}`))) throw Object.assign(new Error('Uploaded file was not found'), { statusCode: 404 });
    const { data, error } = await supabase.from('communication_files').insert({ client_id: input.client_id, f29_period_id: input.f29_period_id, source: 'storage', storage_path: input.path, file_name: input.file_name, mime_type: input.mime_type, size_bytes: input.size_bytes, created_by: user.id }).select('*').single();
    if (error || !data) throw error || new Error('Unable to register attachment');
    await supabase.from('activity_log').insert({ client_id: input.client_id, f29_period_id: input.f29_period_id, actor_id: user.id, action: 'email_attachment_uploaded', entity_type: 'communication_file', entity_id: data.id, after_data: { file_name: input.file_name, size_bytes: input.size_bytes } });
    return json(201, { attachment: data });
  } catch (error) { return functionError(error); }
};
