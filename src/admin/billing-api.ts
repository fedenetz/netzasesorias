import { supabase } from './supabase';
import type { BillingItem, BillingStatus } from './types';

const invoke = async (name: string, body: Record<string, unknown>) => {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('La sesión expiró.');
  const response = await fetch(`/.netlify/functions/${name}`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'No fue posible completar la acción.');
  return result;
};

export async function loadBillingItems(): Promise<BillingItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('billing_items').select('id,client_id,f29_period_id,description,amount,due_date,status,paid_at,payment_method,notes,last_reminder_at,updated_at,clients(legal_name,rut)').order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map(item => {
    const client = Array.isArray(item.clients) ? item.clients[0] : item.clients;
    return { id: item.id, clientId: item.client_id, clientName: client?.legal_name ?? 'Cliente', rut: client?.rut ?? '—', f29PeriodId: item.f29_period_id, description: item.description, amount: Number(item.amount), dueDate: item.due_date, status: item.status, paidAt: item.paid_at, paymentMethod: item.payment_method ?? '', notes: item.notes ?? '', lastReminderAt: item.last_reminder_at, updatedAt: item.updated_at };
  });
}

export const createPaymentLink = (billingItemId: string, externalUrl: string) => invoke('create-payment-link', { billing_item_id: billingItemId, external_url: externalUrl });
export const updateBillingItem = (billingItemId: string, values: { amount?: number; dueDate?: string | null; status?: BillingStatus; paidAt?: string | null; paymentMethod?: string; notes?: string }) => invoke('update-billing-item', { billing_item_id: billingItemId, amount: values.amount, due_date: values.dueDate, status: values.status, paid_at: values.paidAt, payment_method: values.paymentMethod, notes: values.notes });

export async function updateF29Billing(periodId: string, values: { amount: number; dueDate: string | null; status: BillingStatus; paidAt: string | null; paymentMethod: string; notes: string }) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.rpc('upsert_f29_billing', { p_f29_period_id: periodId, p_amount: values.amount, p_due_date: values.dueDate, p_status: values.status, p_paid_at: values.paidAt, p_payment_method: values.paymentMethod || null, p_notes: values.notes || null });
  if (error) throw error;
  return data;
}
