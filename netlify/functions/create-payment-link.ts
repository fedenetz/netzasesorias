import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody } from './_shared';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, user } = await authenticate(event);
    const input = parseBody<{ billing_item_id: string; external_url: string; expires_at?: string }>(event);
    let url: URL;
    try { url = new URL(input.external_url); } catch { throw Object.assign(new Error('A valid payment URL is required'), { statusCode: 400 }); }
    if (url.protocol !== 'https:') throw Object.assign(new Error('Payment URL must use HTTPS'), { statusCode: 400 });
    const { data: item } = await supabase.from('billing_items').select('id,client_id,f29_period_id,amount').eq('id', input.billing_item_id).single();
    if (!item) throw Object.assign(new Error('Billing item not found'), { statusCode: 404 });
    const { data: link, error } = await supabase.from('payment_links').insert({ billing_item_id: item.id, external_url: url.toString(), expires_at: input.expires_at || null, created_by: user.id }).select('*').single();
    if (error || !link) throw error || new Error('Unable to create payment link');
    await supabase.from('payment_events').insert({ billing_item_id: item.id, payment_link_id: link.id, event_type: 'link_created', amount: item.amount, created_by: user.id });
    await supabase.from('activity_log').insert({ client_id: item.client_id, f29_period_id: item.f29_period_id, actor_id: user.id, action: 'payment_link_created', entity_type: 'payment_link', entity_id: link.id, after_data: { external_url: link.external_url, expires_at: link.expires_at } });
    return json(201, { payment_link: link });
  } catch (error) { return functionError(error); }
};
