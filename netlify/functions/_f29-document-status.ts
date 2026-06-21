import type { SupabaseClient } from '@supabase/supabase-js';

export async function ensureF29LoadedStatus({ supabase, actorId, clientId, year, month, source, documentId }: {
  supabase: SupabaseClient;
  actorId: string;
  clientId: string;
  year: number;
  month: number;
  source: 'drive_scan' | 'direct_upload';
  documentId?: string;
}) {
  const { data: existing, error: readError } = await supabase.from('f29_periods').select('id,status_code,status_label').eq('client_id', clientId).eq('year', year).eq('month', month).maybeSingle();
  if (readError) throw readError;
  if (existing?.status_code) return false;

  const before = existing ? { status_code: existing.status_code, status_label: existing.status_label } : null;
  const values = { client_id: clientId, year, month, status_code: 'A', status_label: 'Cargada', updated_at: new Date().toISOString() };
  const query = existing
    ? supabase.from('f29_periods').update(values).eq('id', existing.id)
    : supabase.from('f29_periods').insert(values);
  const { data: period, error: writeError } = await query.select('id').single();
  if (writeError) throw writeError;

  const { error: logError } = await supabase.from('activity_log').insert({
    actor_id: actorId,
    client_id: clientId,
    f29_period_id: period.id,
    action: 'f29_document_marked_loaded',
    entity_type: 'f29_period',
    entity_id: period.id,
    before_data: before,
    after_data: { status_code: 'A', status_label: 'Cargada', source, document_id: documentId ?? null },
  });
  if (logError) throw logError;
  return true;
}
