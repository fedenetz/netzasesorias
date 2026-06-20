import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody, requireClientPeriod } from './_shared';

const allowed = new Set(['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, user } = await authenticate(event);
    const input = parseBody<{ client_id: string; f29_period_id: string; file_name: string; mime_type: string; size_bytes: number }>(event);
    await requireClientPeriod(supabase, input.client_id, input.f29_period_id);
    if (!allowed.has(input.mime_type) || input.size_bytes <= 0 || input.size_bytes > 10 * 1024 * 1024) throw Object.assign(new Error('Unsupported attachment or file exceeds 10 MB'), { statusCode: 400 });
    const safeName = input.file_name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);
    const path = `${input.client_id}/${input.f29_period_id}/${crypto.randomUUID()}-${safeName}`;
    const { data, error } = await supabase.storage.from('email-attachments').createSignedUploadUrl(path);
    if (error || !data) throw error || new Error('Unable to prepare upload');
    return json(200, { path, token: data.token, file_name: input.file_name, mime_type: input.mime_type, size_bytes: input.size_bytes, actor_id: user.id });
  } catch (error) { return functionError(error); }
};
