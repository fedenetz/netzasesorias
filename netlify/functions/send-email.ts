import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, loadAttachments, parseBody, renderTemplate, resolveEmployeeEmail, sanitizeHtml, sendWithResend, validateEmails, type AttachmentInput } from './_shared';
import { renderNetzEmail } from '../../src/shared/email-template';

type Input = { f29_period_id: string; to: string[]; cc?: string[]; subject?: string; body_html?: string; attachments?: AttachmentInput[]; schedule_next_business_morning?: boolean };
const money = (value: number | string | null) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value ?? 0));
const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeZone: 'America/Santiago' }).format(new Date(`${value.slice(0, 10)}T12:00:00-04:00`)) : 'Pendiente';
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CONTROL_EMAIL = 'richard@ainahue.cl';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let logId: string | undefined;
  let context: Awaited<ReturnType<typeof authenticate>> | undefined;
  let scheduled = false;
  try {
    context = await authenticate(event);
    const input = parseBody<Input>(event);
    const to = validateEmails(input.to, true);
    const { data: period, error } = await context.supabase.from('f29_periods')
      .select('id,client_id,year,month,amount,filed_date,status_code,status_label,tax_payment_due_date,responsible_user_id,responsible_name,clients(legal_name,assigned_user_id)')
      .eq('id', input.f29_period_id).single();
    if (error || !period) throw Object.assign(new Error('F29 period not found'), { statusCode: 404 });

    const client = Array.isArray(period.clients) ? period.clients[0] : period.clients;
    const responsibleId = period.responsible_user_id || client?.assigned_user_id;
    const responsibleEmail = await resolveEmployeeEmail(context.supabase, responsibleId, period.responsible_name);
    if (!responsibleEmail) throw Object.assign(new Error(`El responsable ${period.responsible_name || 'asignado'} no tiene email activo en Configuración > Equipo y acceso.`), { statusCode: 409 });
    const cc = validateEmails([...(input.cc ?? []), responsibleEmail, CONTROL_EMAIL].filter(email => !to.includes(String(email).toLowerCase())));

    const { data: template } = await context.supabase.from('email_templates').select('*').eq('key', 'f29_monthly_summary').eq('active', true).single();
    if (!template) throw Object.assign(new Error('Active F29 email template not found'), { statusCode: 409 });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
    const variables = { client_name: String(client?.legal_name ?? 'Cliente'), month_name: months[period.month - 1], year: String(period.year), amount: money(period.amount), filed_date: date(period.filed_date || today), payment_due_date: date(period.tax_payment_due_date), payment_status: period.status_label || 'Sin estado', firm_name: process.env.FIRM_NAME || 'Netz Asesorías' };
    const subject = renderTemplate(input.subject || template.subject, variables).replace(/[\r\n]+/g, ' ').trim();
    const attachmentInputs = input.attachments ?? [];
    const bodyHtml = sanitizeHtml(renderTemplate(input.body_html || template.body_html, variables));
    const attachmentDetails = attachmentInputs.map(item => ({ name: item.file_name || 'Archivo adjunto', detail: item.mime_type?.startsWith('image/') ? 'Comprobante visual · se muestra en el correo y se adjunta' : item.source === 'drive' ? (item.mime_type === 'application/vnd.google-apps.spreadsheet' ? 'Exportado desde Google Drive · Excel' : 'Archivo de Google Drive') : 'Archivo privado adjunto' }));
    const proofs = attachmentInputs.flatMap((item, index) => item.mime_type?.startsWith('image/') ? [{ name: item.file_name || 'Comprobante', src: `cid:proof-${index + 1}` }] : []);
    const replyTo = process.env.RESEND_REPLY_TO_EMAIL || CONTROL_EMAIL;
    const logoUrl = process.env.BRAND_LOGO_URL || (process.env.URL?.startsWith('https://') ? `${process.env.URL}/brand/logo-blanco.png` : undefined);
    const html = sanitizeHtml(renderNetzEmail({ title: 'Formulario 29 del período', eyebrow: 'Información tributaria', clientName: variables.client_name, periodOrConcept: `${variables.month_name} ${variables.year}`, bodyHtml, summary: [{ label: 'Período', value: `${variables.month_name} ${variables.year}` }, { label: 'Monto informado', value: variables.amount }, { label: 'Estado', value: variables.payment_status }, { label: 'Fecha de presentación', value: variables.filed_date }, { label: 'Fecha de pago', value: variables.payment_due_date }], attachments: attachmentDetails, proofs, responsibleName: period.responsible_name || undefined, replyTo, logoUrl }));
    const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorías <operaciones@example.com>';
    const { data: log, error: logError } = await context.supabase.from('email_logs').insert({ client_id: period.client_id, f29_period_id: period.id, template_id: template.id, message_kind: 'f29_summary', from_email: from, to_emails: to, cc_emails: cc, subject, body_html: html, attachments: attachmentInputs, status: 'sending', sent_by: context.user.id }).select('id').single();
    if (logError || !log) throw logError || new Error('Unable to create email log');
    logId = log.id;
    const attachments = await loadAttachments(event, context.supabase, attachmentInputs, period.client_id);
    let scheduledAt: string | undefined;
    if (input.schedule_next_business_morning) {
      const { data: scheduleValue, error: scheduleError } = await context.supabase.rpc('next_chile_business_morning');
      if (scheduleError || !scheduleValue) throw scheduleError || new Error('No fue posible calcular el próximo día hábil.');
      scheduledAt = String(scheduleValue);
    }
    const providerId = await sendWithResend({ from, to, cc, subject, html, attachments, ...(scheduledAt ? { scheduled_at: scheduledAt } : {}), reply_to: replyTo }, log.id);
    if (scheduledAt) {
      scheduled = true;
      const { error: scheduledError } = await context.supabase.rpc('mark_email_scheduled', { p_log_id: log.id, p_provider_message_id: providerId, p_scheduled_at: scheduledAt });
      if (scheduledError) throw scheduledError;
      return json(202, { id: log.id, provider_message_id: providerId, scheduled_at: scheduledAt });
    }
    const { error: finalizeError } = await context.supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'sent', p_provider_message_id: providerId, p_error_message: null });
    if (finalizeError) throw finalizeError;
    return json(200, { id: log.id, provider_message_id: providerId, sent_at: new Date().toISOString() });
  } catch (error) {
    if (logId && context && !scheduled) await context.supabase.rpc('finalize_email_delivery', { p_log_id: logId, p_status: 'failed', p_provider_message_id: null, p_error_message: error instanceof Error ? error.message : 'Unknown error' });
    return functionError(error);
  }
};
