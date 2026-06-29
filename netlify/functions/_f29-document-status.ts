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
  const { data: existing, error: readError } = await supabase
    .from('f29_periods')
    .select('id,status_code,status_label,review_status')
    .eq('client_id', clientId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (readError) throw readError;

  const before = existing ? {
    status_code: existing.status_code,
    status_label: existing.status_label,
    review_status: existing.review_status,
  } : null;
  const reviewStatus = existing?.review_status === 'pending_admin_review' || existing?.review_status === 'approved'
    ? existing.review_status
    : 'none';
  const values = {
    client_id: clientId,
    year,
    month,
    status_code: 'A',
    status_label: 'Cargada',
    review_status: reviewStatus,
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? supabase.from('f29_periods').update(values).eq('id', existing.id)
    : supabase.from('f29_periods').insert(values);
  const { data: period, error: writeError } = await query.select('id').single();
  if (writeError) throw writeError;

  if (existing?.status_code !== 'A' || existing?.review_status !== reviewStatus) {
    const { error: logError } = await supabase.from('activity_log').insert({
      actor_id: actorId,
      client_id: clientId,
      f29_period_id: period.id,
      action: 'f29_document_marked_loaded',
      entity_type: 'f29_period',
      entity_id: period.id,
      before_data: before,
      after_data: { ...values, source, document_id: documentId ?? null },
    });
    if (logError) throw logError;
  }

  return period.id as string;
}

export async function sendF29AdminReviewNotice({ supabase, actorId, periodId, documentId }: {
  supabase: SupabaseClient;
  actorId: string;
  periodId: string;
  documentId?: string;
}) {
  const { data: period, error: periodError } = await supabase
    .from('f29_periods')
    .select('id,client_id,year,month,status_code,status_label,review_status')
    .eq('id', periodId)
    .single();
  if (periodError || !period) throw Object.assign(periodError ?? new Error('F29 period not found'), { statusCode: 404 });
  if (period.status_code !== 'A') {
    throw Object.assign(new Error('El F29 debe estar cargado antes de avisar a administracion.'), { statusCode: 409, code: 'document_not_loaded' });
  }
  if (period.review_status === 'approved') {
    throw Object.assign(new Error('La revision administrativa ya esta aprobada.'), { statusCode: 409, code: 'already_approved' });
  }

  const { data: prior } = await supabase
    .from('email_logs')
    .select('id')
    .eq('f29_period_id', period.id)
    .eq('message_kind', 'f29_admin_review')
    .in('status', ['sending', 'sent'])
    .maybeSingle();
  if (prior) throw Object.assign(new Error('El aviso a administracion ya fue enviado.'), { statusCode: 409, code: 'already_notified' });

  const [{ data: client }, { data: document }, { data: actor }] = await Promise.all([
    supabase.from('clients').select('legal_name,rut').eq('id', period.client_id).single(),
    documentId ? supabase.from('documents').select('file_name,drive_web_view_link').eq('id', documentId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name').eq('id', actorId).maybeSingle(),
  ]);
  const baseUrl = process.env.URL?.startsWith('https://') ? process.env.URL : '';
  const monthText = String(period.month).padStart(2, '0');
  const deepLink = `${baseUrl}/f29/${period.year}/${monthText}?review=${period.id}`;
  const subject = `Revision F29 pendiente - ${client?.legal_name ?? 'Cliente'} - ${monthText}/${period.year}`;
  const documentLabel = document?.drive_web_view_link
    ? `<a href="${document.drive_web_view_link}">${document.file_name}</a>`
    : document?.file_name ?? 'Excel confirmado por el contador';
  const html = `<div style="font-family:Arial,sans-serif;color:#17202a"><h2>F29 listo para revision administrativa</h2><p><strong>${client?.legal_name ?? 'Cliente'}</strong> - ${client?.rut ?? 'RUT no informado'}</p><p>Periodo: ${monthText}/${period.year}<br>Responsable: ${actor?.full_name ?? 'Sin asignar'}</p><p>Archivo: ${documentLabel}</p><p>El contador confirmo que el archivo esta cargado e indexado correctamente. No se ha contactado al cliente.</p><p><a href="${deepLink}">Abrir compositor y revisar</a></p></div>`;
  const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorias <operaciones@example.com>';
  const { data: emailLog, error: emailLogError } = await supabase.from('email_logs').insert({
    client_id: period.client_id,
    f29_period_id: period.id,
    message_kind: 'f29_admin_review',
    from_email: from,
    to_emails: [CONTROL_EMAIL],
    cc_emails: [],
    subject,
    body_html: html,
    status: 'sending',
    sent_by: actorId,
  }).select('id').single();
  if (emailLogError || !emailLog) throw emailLogError || new Error('Unable to create admin review log');

  try {
    const providerId = await sendWithResend({ from, to: [CONTROL_EMAIL], cc: [], subject, html, attachments: [] }, `f29-admin-review-${period.id}`);
    const { error: finalizeError } = await supabase.rpc('finalize_email_delivery', {
      p_log_id: emailLog.id,
      p_status: 'sent',
      p_provider_message_id: providerId,
      p_error_message: null,
    });
    if (finalizeError) throw finalizeError;
    await supabase.from('activity_log').insert({
      actor_id: actorId,
      client_id: period.client_id,
      f29_period_id: period.id,
      action: 'f29_admin_review_requested',
      entity_type: 'f29_period',
      entity_id: period.id,
      after_data: { email_log_id: emailLog.id, to: CONTROL_EMAIL, document_id: documentId ?? null },
    });
  } catch (error) {
    await supabase.rpc('finalize_email_delivery', {
      p_log_id: emailLog.id,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error_message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }

  return emailLog.id as string;
}
