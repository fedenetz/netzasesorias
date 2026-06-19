import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody, renderTemplate, sanitizeHtml, sendWithResend, validateEmails } from './_shared';

type Input = { billing_item_id: string; to: string[]; cc?: string[]; subject?: string; body_html?: string };
const money = (value: number | string) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value));

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let logId: string | undefined;
  let context: Awaited<ReturnType<typeof authenticate>> | undefined;
  try {
    context = await authenticate(event);
    const input = parseBody<Input>(event);
    const to = validateEmails(input.to, true);
    const cc = validateEmails(input.cc ?? []);
    const { data: item } = await context.supabase.from('billing_items').select('*,clients(legal_name)').eq('id', input.billing_item_id).single();
    if (!item) throw Object.assign(new Error('Billing item not found'), { statusCode: 404 });
    const { data: template } = await context.supabase.from('email_templates').select('*').eq('key', 'payment_reminder').eq('active', true).single();
    if (!template) throw Object.assign(new Error('Active reminder template not found'), { statusCode: 409 });
    const clientName = String((Array.isArray(item.clients) ? item.clients[0]?.legal_name : item.clients?.legal_name) ?? 'Cliente');
    const vars = { client_name: clientName, billing_amount: money(item.amount), due_date: item.due_date || 'Sin fecha', billing_status: item.status, service_period: item.description, firm_name: process.env.FIRM_NAME || 'Netz Asesorías' };
    const subject = renderTemplate(input.subject || template.subject, vars).trim();
    const html = sanitizeHtml(renderTemplate(input.body_html || template.body_html, vars));
    const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorías <operaciones@example.com>';
    const { data: log, error } = await context.supabase.from('email_logs').insert({ client_id: item.client_id, f29_period_id: item.f29_period_id, billing_item_id: item.id, template_id: template.id, message_kind: 'payment_reminder', from_email: from, to_emails: to, cc_emails: cc, subject, body_html: html, status: 'sending', sent_by: context.user.id }).select('id').single();
    if (error || !log) throw error || new Error('Unable to create email log');
    logId = log.id;
    const providerId = await sendWithResend({ from, to, cc, subject, html, attachments: [] }, log.id);
    const { error: finalizeError } = await context.supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'sent', p_provider_message_id: providerId, p_error_message: null });
    if (finalizeError) throw finalizeError;
    return json(200, { id: log.id, provider_message_id: providerId });
  } catch (error) {
    if (logId && context) await context.supabase.rpc('finalize_email_delivery', { p_log_id: logId, p_status: 'failed', p_provider_message_id: null, p_error_message: error instanceof Error ? error.message : 'Unknown error' });
    return functionError(error);
  }
};
