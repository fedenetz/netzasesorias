import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody } from './_shared';

type Input = { client_id: string; service_id?: string | null; description: string; amount: number; due_date?: string | null; period_year?: number | null; period_month?: number | null; notes?: string | null };

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { supabase, user } = await authenticate(event);
    const input = parseBody<Input>(event);
    if (!input.client_id) throw Object.assign(new Error('Client is required'), { statusCode: 400 });
    if (!input.description?.trim()) throw Object.assign(new Error('Description is required'), { statusCode: 400 });
    const amount = Math.round(Number(input.amount));
    if (!Number.isFinite(amount) || amount < 0) throw Object.assign(new Error('Amount must be zero or greater'), { statusCode: 400 });
    const { data: client } = await supabase.from('clients').select('id').eq('id', input.client_id).eq('is_active', true).maybeSingle();
    if (!client) throw Object.assign(new Error('Client not found'), { statusCode: 404 });
    let clientServiceId: string | null = null;
    if (input.service_id) {
      const { data: service } = await supabase.from('services').select('id').eq('id', input.service_id).eq('active', true).maybeSingle();
      if (!service) throw Object.assign(new Error('Service not found'), { statusCode: 404 });
      const { data: relation, error: relationError } = await supabase.from('client_services').upsert({ client_id: client.id, service_id: service.id, agreed_amount: amount, active: true }, { onConflict: 'client_id,service_id' }).select('id').single();
      if (relationError || !relation) throw relationError || new Error('Unable to associate service');
      clientServiceId = relation.id;
    }
    const { data: item, error } = await supabase.from('billing_items').insert({ client_id: client.id, client_service_id: clientServiceId, description: input.description.trim(), amount, due_date: input.due_date || null, period_year: input.period_year || null, period_month: input.period_month || null, notes: input.notes?.trim() || null, status: 'pending', created_by: user.id }).select('*').single();
    if (error || !item) throw error || new Error('Unable to create billing item');
    await supabase.from('payment_events').insert({ billing_item_id: item.id, event_type: 'created', amount: item.amount, created_by: user.id });
    await supabase.from('activity_log').insert({ client_id: item.client_id, actor_id: user.id, action: 'billing_item_created', entity_type: 'billing_item', entity_id: item.id, after_data: item });
    return json(201, { billing_item: item });
  } catch (error) { return functionError(error); }
};
