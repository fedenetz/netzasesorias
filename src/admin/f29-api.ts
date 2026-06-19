import type { ClientRow } from './types';
import { supabase } from './supabase';

export async function persistF29Change(row: ClientRow, patch: Partial<ClientRow>) {
  if (!supabase) return row.periodId;
  const beforeData = Object.fromEntries(Object.keys(patch).map(key => [key, row[key as keyof ClientRow]]));
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('amount' in patch) dbPatch.amount = patch.amount;
  if ('filedDate' in patch) dbPatch.filed_date = patch.filedDate || null;
  if ('statusCode' in patch) {
    dbPatch.status_code = patch.statusCode;
    dbPatch.status_label = patch.statusLabel;
  }
  if ('observation' in patch) dbPatch.observation = patch.observation;
  if ('accountant' in patch) dbPatch.responsible_name = patch.accountant;

  const query = row.periodId
    ? supabase.from('f29_periods').update(dbPatch).eq('id', row.periodId)
    : supabase.from('f29_periods').upsert({ client_id: row.id, year: row.year, month: row.month, ...dbPatch }, { onConflict: 'client_id,year,month' });
  const { data: period, error } = await query.select('id,client_id').single();
  if (error) throw error;
  const billingChanged = ['billingAmount', 'billingDueDate', 'billingStatus', 'paidAt', 'paymentMethod', 'paymentNotes'].some(key => key in patch);
  if (billingChanged) {
    const status = patch.billingStatus ?? row.billingStatus;
    const { error: billingError } = await supabase.rpc('upsert_f29_billing', {
      p_f29_period_id: period.id,
      p_amount: patch.billingAmount ?? row.billingAmount ?? 0,
      p_due_date: patch.billingDueDate ?? row.billingDueDate,
      p_status: status,
      p_payment_method: (patch.paymentMethod ?? row.paymentMethod) || null,
      p_notes: (patch.paymentNotes ?? row.paymentNotes) || null,
      p_paid_at: status === 'paid' ? patch.paidAt ?? row.paidAt ?? new Date().toISOString() : null,
    });
    if (billingError) throw billingError;
  }
  const { data: { user } } = await supabase.auth.getUser();
  const { error: logError } = await supabase.from('activity_log').insert({
    actor_id: user?.id,
    client_id: period.client_id,
    f29_period_id: period.id,
    action: 'f29_period_updated',
    entity_type: 'f29_period',
    entity_id: period.id,
    before_data: beforeData,
    after_data: patch,
  });
  if (logError) throw logError;
  return period.id as string;
}
