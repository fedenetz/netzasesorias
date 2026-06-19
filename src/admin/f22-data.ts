import { supabase } from './supabase';
import type { F22Row } from './types';

type F22Record = {
  id: string; client_id: string; tax_year: number; prepared_to_send: boolean; sent: boolean; saved: boolean;
  refund_amount: number | string | null; payment_amount: number | string | null; filed_date: string | null; review_status: string | null;
  tax_regime: string | null; regime_detail: string | null; bce_date: string | null; bce_status: string | null; f22_ready: boolean | null;
  f22_sent: boolean; dj_1948: boolean | null; dj_1948_sent: boolean | null; dj_1949: boolean | null; provisional: boolean | null;
  utility_loss_text: string | null; utility_loss_amount: number | string | null; dividends_text: string | null; dividends_amount: number | string | null;
  partners: string | null; refund_payment_text: string | null; observation: string | null; responsible_user_id: string | null; responsible_name: string | null; updated_at: string;
};

const numberOrNull = (value: number | string | null) => value === null || value === '' ? null : Number(value);

export async function loadF22Rows(taxYear: number): Promise<F22Row[]> {
  if (!supabase) return [];
  const [periodsResult, clientsResult, profilesResult] = await Promise.all([
    supabase.from('f22_periods').select('*').eq('tax_year', taxYear),
    supabase.from('clients').select('id,rut,legal_name,assigned_user_id').eq('is_active', true).eq('f22_enabled', true),
    supabase.from('profiles').select('id,full_name').eq('is_active', true),
  ]);
  if (periodsResult.error) throw periodsResult.error;
  if (clientsResult.error) throw clientsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  const clients = new Map((clientsResult.data ?? []).map(client => [client.id, client]));
  const profiles = new Map((profilesResult.data ?? []).map(profile => [profile.id, profile.full_name ?? 'Sin asignar']));
  return (periodsResult.data as F22Record[]).map(period => {
    const client = clients.get(period.client_id);
    const responsibleName = period.responsible_name || (period.responsible_user_id ? profiles.get(period.responsible_user_id) : null) || (client?.assigned_user_id ? profiles.get(client.assigned_user_id) : null) || 'Sin asignar';
    return {
      id: period.id, clientId: period.client_id, rut: client?.rut ?? '—', name: client?.legal_name ?? 'Cliente sin ficha', taxYear: period.tax_year,
      preparedToSend: period.prepared_to_send, sent: period.sent, saved: period.saved, refundAmount: numberOrNull(period.refund_amount), paymentAmount: numberOrNull(period.payment_amount), filedDate: period.filed_date,
      reviewStatus: period.review_status ?? '', taxRegime: period.tax_regime ?? '', regimeDetail: period.regime_detail ?? '', bceDate: period.bce_date, bceStatus: period.bce_status ?? 'Pendiente',
      f22Ready: period.f22_ready, f22Sent: period.f22_sent, dj1948: period.dj_1948, dj1948Sent: period.dj_1948_sent, dj1949: period.dj_1949, provisional: period.provisional,
      utilityLossText: period.utility_loss_text ?? '', utilityLossAmount: numberOrNull(period.utility_loss_amount), dividendsText: period.dividends_text ?? '', dividendsAmount: numberOrNull(period.dividends_amount),
      partners: period.partners ?? '', refundPaymentText: period.refund_payment_text ?? '', observation: period.observation ?? '', responsibleName, updatedAt: period.updated_at,
    };
  }).filter(row => clients.has(row.clientId)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function loadClientF22(clientId: string, taxYear: number): Promise<F22Row | null> {
  const rows = await loadF22Rows(taxYear);
  return rows.find(row => row.clientId === clientId) ?? null;
}

export async function persistF22Change(row: F22Row, patch: Partial<F22Row>) {
  if (!supabase) return;
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const mapping: Partial<Record<keyof F22Row, string>> = {
    bceDate: 'bce_date', bceStatus: 'bce_status', f22Ready: 'f22_ready', f22Sent: 'f22_sent', dj1948: 'dj_1948', dj1948Sent: 'dj_1948_sent', dj1949: 'dj_1949', provisional: 'provisional',
    utilityLossText: 'utility_loss_text', utilityLossAmount: 'utility_loss_amount', dividendsText: 'dividends_text', dividendsAmount: 'dividends_amount', observation: 'observation', responsibleName: 'responsible_name', reviewStatus: 'review_status',
  };
  for (const [key, value] of Object.entries(patch) as [keyof F22Row, unknown][]) if (mapping[key]) dbPatch[mapping[key]!] = value === '' ? null : value;
  const before = Object.fromEntries(Object.keys(patch).map(key => [key, row[key as keyof F22Row]]));
  const { error } = await supabase.from('f22_periods').update(dbPatch).eq('id', row.id);
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('activity_log').insert({ actor_id: user?.id, client_id: row.clientId, f22_period_id: row.id, action: 'f22_period_updated', entity_type: 'f22_period', entity_id: row.id, before_data: before, after_data: patch });
}
