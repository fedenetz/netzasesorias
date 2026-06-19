import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, loadAttachments, parseBody, renderTemplate, sanitizeHtml, sendWithResend, validateEmails, type AttachmentInput } from './_shared';

type Input = { f29_period_id: string; to: string[]; cc?: string[]; subject?: string; body_html?: string; attachments?: AttachmentInput[] };
const money = (value: number | string | null) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value ?? 0));
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let logId: string | undefined;
  let context: Awaited<ReturnType<typeof authenticate>> | undefined;
  try {
    context = await authenticate(event);
    const input = parseBody<Input>(event);
    const to = validateEmails(input.to, true);
    const cc = validateEmails(input.cc ?? []);
    const { data: period, error } = await context.supabase.from('f29_periods')
      .select('id,client_id,year,month,amount,filed_date,status_label,clients(legal_name)')
      .eq('id', input.f29_period_id).single();
    if (error || !period) throw Object.assign(new Error('F29 period not found'), { statusCode: 404 });
    const { data: template } = await context.supabase.from('email_templates').select('*').eq('key', 'f29_monthly_summary').eq('active', true).single();
    if (!template) throw Object.assign(new Error('Active F29 email template not found'), { statusCode: 409 });
    const clientName = String((Array.isArray(period.clients) ? period.clients[0]?.legal_name : (period.clients as { legal_name?: string } | null)?.legal_name) ?? 'Cliente');
    const variables = { client_name: clientName, month_name: months[period.month - 1], year: String(period.year), amount: money(period.amount), filed_date: period.filed_date || 'Pendiente', payment_status: period.status_label || 'Sin estado', firm_name: process.env.FIRM_NAME || 'Netz Asesorías' };
    const subject = renderTemplate(input.subject || template.subject, variables).trim();
    const html = sanitizeHtml(renderTemplate(input.body_html || template.body_html, variables));
    const attachmentInputs = input.attachments ?? [];
    const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorías <operaciones@example.com>';
    const { data: log, error: logError } = await context.supabase.from('email_logs').insert({ client_id: period.client_id, f29_period_id: period.id, template_id: template.id, message_kind: 'f29_summary', from_email: from, to_emails: to, cc_emails: cc, subject, body_html: html, attachments: attachmentInputs, status: 'sending', sent_by: context.user.id }).select('id').single();
    if (logError || !log) throw logError || new Error('Unable to create email log');
    logId = log.id;
    const attachments = await loadAttachments(event, context.supabase, attachmentInputs, period.client_id);
    const providerId = await sendWithResend({ from, to, cc, subject, html, attachments }, log.id);
    const { error: finalizeError } = await context.supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'sent', p_provider_message_id: providerId, p_error_message: null });
    if (finalizeError) throw finalizeError;
    return json(200, { id: log.id, provider_message_id: providerId, sent_at: new Date().toISOString() });
  } catch (error) {
    if (logId && context) await context.supabase.rpc('finalize_email_delivery', { p_log_id: logId, p_status: 'failed', p_provider_message_id: null, p_error_message: error instanceof Error ? error.message : 'Unknown error' });
    return functionError(error);
  }
};
