import type { Handler } from '@netlify/functions';
import { authenticate, functionError, json, parseBody, renderTemplate, sanitizeHtml, sendWithResend, validateEmails } from './_shared';

type Input = { billing_item_id?: string; f29_period_id?: string; to: string[]; cc?: string[]; subject?: string; body_html?: string };
const money = (value: number | string | null) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value ?? 0));
const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const clientName = (value: unknown) => String((Array.isArray(value) ? value[0]?.legal_name : (value as { legal_name?: string } | null)?.legal_name) ?? 'Cliente');
const CONTROL_EMAIL = 'richard@ainahue.cl';

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let logId: string | undefined;
  let context: Awaited<ReturnType<typeof authenticate>> | undefined;
  try {
    context = await authenticate(event);
    const input = parseBody<Input>(event);
    const to = validateEmails(input.to, true);
    let cc = validateEmails(input.cc ?? []);
    if (!input.f29_period_id && !input.billing_item_id) throw Object.assign(new Error('An F29 period or billing item is required'), { statusCode: 400 });

    let clientId = '';
    let f29PeriodId: string | null = null;
    let billingItemId: string | null = null;
    let templateKey = 'payment_reminder';
    let messageKind: 'f29_payment_reminder' | 'payment_reminder' = 'payment_reminder';
    let variables: Record<string, string>;

    if (input.f29_period_id) {
      const { data: period } = await context.supabase.from('f29_periods').select('id,client_id,year,month,amount,due_day,tax_paid,responsible_user_id,responsible_name,clients(legal_name,assigned_user_id)').eq('id', input.f29_period_id).single();
      if (!period) throw Object.assign(new Error('F29 period not found'), { statusCode: 404 });
      if (period.tax_paid) throw Object.assign(new Error('The F29 period is already marked as paid'), { statusCode: 409 });
      clientId = period.client_id; f29PeriodId = period.id; templateKey = 'f29_payment_reminder'; messageKind = 'f29_payment_reminder';
      const client = Array.isArray(period.clients) ? period.clients[0] : period.clients;
      const responsibleId = period.responsible_user_id || client?.assigned_user_id;
      let responsibleEmail = '';
      if (responsibleId) {
        const { data: profile } = await context.supabase.from('profiles').select('email').eq('id', responsibleId).eq('is_active', true).maybeSingle();
        responsibleEmail = profile?.email ?? '';
      } else if (period.responsible_name) {
        const { data: profile } = await context.supabase.from('profiles').select('email').ilike('full_name', period.responsible_name).eq('is_active', true).maybeSingle();
        responsibleEmail = profile?.email ?? '';
      }
      if (!responsibleEmail) throw Object.assign(new Error('El responsable del cliente debe tener un email activo en Perfiles.'), { statusCode: 409 });
      cc = validateEmails([...cc, responsibleEmail, CONTROL_EMAIL].filter(email => !to.includes(email.toLowerCase())));
      variables = { client_name: clientName(period.clients), month_name: months[period.month - 1], year: String(period.year), amount: money(period.amount), due_day: period.due_day ? String(period.due_day) : '—', firm_name: process.env.FIRM_NAME || 'Netz Asesorías' };
    } else {
      const { data: item } = await context.supabase.from('billing_items').select('*,clients(legal_name)').eq('id', input.billing_item_id).single();
      if (!item) throw Object.assign(new Error('Billing item not found'), { statusCode: 404 });
      clientId = item.client_id; f29PeriodId = item.f29_period_id; billingItemId = item.id;
      variables = { client_name: clientName(item.clients), billing_amount: money(item.amount), due_date: item.due_date || 'Sin fecha', billing_status: item.status, service_period: item.description, firm_name: process.env.FIRM_NAME || 'Netz Asesorías' };
    }

    const { data: template } = await context.supabase.from('email_templates').select('*').eq('key', templateKey).eq('active', true).single();
    if (!template) throw Object.assign(new Error('Active reminder template not found'), { statusCode: 409 });
    const subject = renderTemplate(input.subject || template.subject, variables).replace(/[\r\n]+/g, ' ').trim();
    const html = sanitizeHtml(renderTemplate(input.body_html || template.body_html, variables));
    const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorías <operaciones@example.com>';
    const { data: log, error } = await context.supabase.from('email_logs').insert({ client_id: clientId, f29_period_id: f29PeriodId, billing_item_id: billingItemId, template_id: template.id, message_kind: messageKind, from_email: from, to_emails: to, cc_emails: cc, subject, body_html: html, status: 'sending', sent_by: context.user.id }).select('id').single();
    if (error || !log) throw error || new Error('Unable to create email log');
    logId = log.id;
    const providerId = await sendWithResend({ from, to, cc, subject, html, attachments: [], reply_to: process.env.RESEND_REPLY_TO_EMAIL || CONTROL_EMAIL }, log.id);
    const { error: finalizeError } = await context.supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'sent', p_provider_message_id: providerId, p_error_message: null });
    if (finalizeError) throw finalizeError;
    return json(200, { id: log.id, provider_message_id: providerId });
  } catch (error) {
    if (logId && context) await context.supabase.rpc('finalize_email_delivery', { p_log_id: logId, p_status: 'failed', p_provider_message_id: null, p_error_message: error instanceof Error ? error.message : 'Unknown error' });
    return functionError(error);
  }
};
