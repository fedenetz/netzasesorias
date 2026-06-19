import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody } from './_shared';

type Input = { billing_item_id: string; amount?: number; due_date?: string | null; status?: 'not_applicable' | 'pending' | 'sent' | 'paid' | 'overdue'; paid_at?: string | null; payment_method?: string | null; notes?: string | null };

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, user } = await authenticate(event);
    const input = parseBody<Input>(event);
    const { data: before } = await supabase.from('billing_items').select('*').eq('id', input.billing_item_id).single();
    if (!before) throw Object.assign(new Error('Billing item not found'), { statusCode: 404 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.amount !== undefined) patch.amount = Math.max(0, Number(input.amount));
    if (input.due_date !== undefined) patch.due_date = input.due_date;
    if (input.status !== undefined) { patch.status = input.status; patch.paid_at = input.status === 'paid' ? input.paid_at || before.paid_at || new Date().toISOString() : null; }
    else if (input.paid_at !== undefined) patch.paid_at = input.paid_at;
    if (input.payment_method !== undefined) patch.payment_method = input.payment_method;
    if (input.notes !== undefined) patch.notes = input.notes;
    const { data: item, error } = await supabase.from('billing_items').update(patch).eq('id', before.id).select('*').single();
    if (error || !item) throw error || new Error('Unable to update billing item');
    const eventType = input.status === 'paid' ? 'marked_paid' : before.status === 'paid' && input.status !== undefined ? 'marked_unpaid' : 'updated';
    await supabase.from('payment_events').insert({ billing_item_id: item.id, event_type: eventType, amount: item.amount, payment_method: item.payment_method, metadata: { before_status: before.status, after_status: item.status }, created_by: user.id });
    await supabase.from('activity_log').insert({ client_id: item.client_id, f29_period_id: item.f29_period_id, actor_id: user.id, action: 'billing_item_updated', entity_type: 'billing_item', entity_id: item.id, before_data: before, after_data: item });
    return json(200, { billing_item: item });
  } catch (error) { return functionError(error); }
};
