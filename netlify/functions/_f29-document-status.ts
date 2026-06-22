import type { SupabaseClient } from '@supabase/supabase-js';
import { sendWithResend } from './_shared';

const CONTROL_EMAIL = 'richard@ainahue.cl';

export async function ensureF29LoadedStatus({ supabase, actorId, clientId, year, month, source, documentId }: {
  supabase: SupabaseClient;
  actorId: string;
  clientId: string;
  year: number;
  month: number;
  source: 'drive_scan' | 'direct_upload';
  documentId?: string;
}) {
  const { data: existing, error: readError } = await supabase.from('f29_periods').select('id,status_code,status_label,review_status').eq('client_id', clientId).eq('year', year).eq('month', month).maybeSingle();
  if (readError) throw readError;
  const before = existing ? { status_code: existing.status_code, status_label: existing.status_label, review_status: existing.review_status } : null;
  const values = { client_id: clientId, year, month, status_code: 'A', status_label: 'Cargada', review_status: 'pending_admin_review', updated_at: new Date().toISOString() };
  const query = existing ? supabase.from('f29_periods').update(values).eq('id', existing.id) : supabase.from('f29_periods').insert(values);
  const { data: period, error: writeError } = await query.select('id').single();
  if (writeError) throw writeError;
  if (existing?.status_code !== 'A' || existing?.review_status !== 'pending_admin_review') {
    const { error: logError } = await supabase.from('activity_log').insert({ actor_id: actorId, client_id: clientId, f29_period_id: period.id, action: 'f29_document_marked_loaded', entity_type: 'f29_period', entity_id: period.id, before_data: before, after_data: { ...values, source, document_id: documentId ?? null } });
    if (logError) throw logError;
  }

  const { data: prior } = await supabase.from('email_logs').select('id').eq('f29_period_id', period.id).eq('message_kind', 'f29_admin_review').in('status', ['sending','sent']).maybeSingle();
  if (prior) return false;
  const [{ data: client }, { data: document }, { data: actor }] = await Promise.all([
    supabase.from('clients').select('legal_name,rut').eq('id', clientId).single(),
    documentId ? supabase.from('documents').select('file_name,drive_web_view_link').eq('id', documentId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name').eq('id', actorId).maybeSingle(),
  ]);
  const baseUrl = process.env.URL?.startsWith('https://') ? process.env.URL : '';
  const deepLink = `${baseUrl}/f29/${year}/${String(month).padStart(2, '0')}?review=${period.id}`;
  const subject = `Revisión F29 pendiente · ${client?.legal_name ?? 'Cliente'} · ${String(month).padStart(2, '0')}/${year}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#17202a"><h2>F29 listo para revisión administrativa</h2><p><strong>${client?.legal_name ?? 'Cliente'}</strong> · ${client?.rut ?? 'RUT no informado'}</p><p>Período: ${String(month).padStart(2, '0')}/${year}<br>Responsable: ${actor?.full_name ?? 'Sin asignar'}</p><p>Archivo: ${document?.drive_web_view_link ? `<a href="${document.drive_web_view_link}">${document.file_name}</a>` : document?.file_name ?? 'Excel detectado durante escaneo'}</p><p>Vista previa del correo final: resumen F29 del período, monto y fecha de pago según los datos cargados. No se ha contactado al cliente.</p><p><a href="${deepLink}">Abrir compositor y revisar</a></p></div>`;
  const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorías <operaciones@example.com>';
  const { data: emailLog, error: emailLogError } = await supabase.from('email_logs').insert({ client_id: clientId, f29_period_id: period.id, message_kind: 'f29_admin_review', from_email: from, to_emails: [CONTROL_EMAIL], cc_emails: [], subject, body_html: html, status: 'sending', sent_by: actorId }).select('id').single();
  if (emailLogError || !emailLog) throw emailLogError || new Error('Unable to create admin review log');
  try {
    const providerId = await sendWithResend({ from, to: [CONTROL_EMAIL], cc: [], subject, html, attachments: [] }, `f29-admin-review-${period.id}`);
    await supabase.rpc('finalize_email_delivery', { p_log_id: emailLog.id, p_status: 'sent', p_provider_message_id: providerId, p_error_message: null });
  } catch (error) {
    await supabase.rpc('finalize_email_delivery', { p_log_id: emailLog.id, p_status: 'failed', p_provider_message_id: null, p_error_message: error instanceof Error ? error.message : 'Unknown error' });
    throw error;
  }
  return true;
}
