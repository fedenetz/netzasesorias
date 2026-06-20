import { schedule, type Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { json } from './_shared';

const reconcile: Handler = async () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!url || !serviceKey || !resendKey) return json(500, { error: 'Missing server configuration' });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: logs, error } = await supabase.from('email_logs').select('id,provider_message_id').eq('status', 'sending').not('scheduled_at', 'is', null).lte('scheduled_at', new Date().toISOString()).limit(100);
  if (error) return json(500, { error: error.message });
  let finalized = 0;
  for (const log of logs ?? []) {
    if (!log.provider_message_id) continue;
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(log.provider_message_id)}`, { headers: { Authorization: `Bearer ${resendKey}` } });
    if (!response.ok) continue;
    const message = await response.json() as { last_event?: string };
    if (['sent', 'delivered', 'delivery_delayed'].includes(message.last_event ?? '')) {
      const { error: finalizeError } = await supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'sent', p_provider_message_id: log.provider_message_id, p_error_message: null });
      if (!finalizeError) finalized++;
    } else if (['bounced', 'failed', 'canceled', 'complained'].includes(message.last_event ?? '')) {
      await supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'failed', p_provider_message_id: log.provider_message_id, p_error_message: `Resend event: ${message.last_event}` });
      finalized++;
    }
  }
  return json(200, { checked: logs?.length ?? 0, finalized });
};

// Netlify scheduled functions have no public URL; wrapping prevents user-triggered reconciliation.
export const handler = schedule('*/10 * * * *', reconcile);
