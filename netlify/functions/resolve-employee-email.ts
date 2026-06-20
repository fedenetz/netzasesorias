import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody, resolveEmployeeEmail } from './_shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase } = await authenticate(event, 'view');
    const input = parseBody<{ full_name?: string; profile_id?: string }>(event);
    const email = await resolveEmployeeEmail(supabase, input.profile_id || null, input.full_name || null);
    return json(200, { email: email || null });
  } catch (error) { return functionError(error); }
};
