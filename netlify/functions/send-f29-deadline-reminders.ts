import { schedule, type Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { sendWithResend } from './_shared';

const CONTROL_EMAIL = 'richard@ainahue.cl';
const chileDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

const run: Handler = async () => {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { statusCode: 500, body: 'Missing Supabase configuration' };
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const tomorrow = chileDate(new Date(Date.now() + 36 * 60 * 60 * 1000));
  const { data: systemActor } = await supabase.from('profiles').select('id').eq('is_active', true).eq('role', 'admin').limit(1).maybeSingle();
  if (!systemActor) return { statusCode: 500, body: 'No active admin profile for audit actor' };
  const { data: periods, error } = await supabase.from('f29_periods').select('id,client_id,year,month,amount,responsible_user_id,responsible_name,clients(legal_name)').eq('status_code', 'C').eq('tax_paid', false).eq('tax_payment_due_date', tomorrow).is('reminder_sent_at', null).limit(100);
  if (error) return { statusCode: 500, body: error.message };
  let sent = 0;
  for (const period of periods ?? []) {
    const [{ data: contacts }, { data: responsible }] = await Promise.all([
      supabase.from('client_contacts').select('email').eq('client_id', period.client_id).eq('is_active', true).or('is_primary.eq.true,is_billing.eq.true'),
      period.responsible_user_id ? supabase.from('profiles').select('email').eq('id', period.responsible_user_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const to = [...new Set((contacts ?? []).map(item => String(item.email).toLowerCase()))];
    if (!to.length) continue;
    const cc = [...new Set([responsible?.email, CONTROL_EMAIL].filter(Boolean).map(value => String(value).toLowerCase()))];
    const client = Array.isArray(period.clients) ? period.clients[0] : period.clients;
    const subject = `Recordatorio pago F29 · ${String(period.month).padStart(2, '0')}/${period.year} · ${client?.legal_name ?? 'Cliente'}`;
    const amount = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(period.amount ?? 0));
    const html = `<div style="font-family:Arial,sans-serif;color:#17202a"><h2>Recordatorio de pago F29</h2><p>Estimado/a ${client?.legal_name ?? 'cliente'},</p><p>El pago del Formulario 29 de ${String(period.month).padStart(2, '0')}/${period.year}, por <strong>${amount}</strong>, vence mañana ${tomorrow}.</p><p>Si ya realizó el pago, puede omitir este mensaje.</p><p>Netz Asesorías</p></div>`;
    const from = process.env.RESEND_FROM_EMAIL || 'Netz Asesorías <operaciones@example.com>';
    const { data: log, error: logError } = await supabase.from('email_logs').insert({ client_id: period.client_id, f29_period_id: period.id, message_kind: 'f29_payment_reminder', from_email: from, to_emails: to, cc_emails: cc, subject, body_html: html, status: 'sending', sent_by: systemActor.id }).select('id').single();
    if (logError || !log) continue;
    try {
      const providerId = await sendWithResend({ from, to, cc, subject, html, attachments: [], reply_to: process.env.RESEND_REPLY_TO_EMAIL || CONTROL_EMAIL }, `f29-deadline-reminder-${period.id}`);
      await supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'sent', p_provider_message_id: providerId, p_error_message: null }); sent++;
    } catch (reason) {
      await supabase.rpc('finalize_email_delivery', { p_log_id: log.id, p_status: 'failed', p_provider_message_id: null, p_error_message: reason instanceof Error ? reason.message : 'Unknown error' });
    }
  }
  return { statusCode: 200, body: JSON.stringify({ checked: periods?.length ?? 0, sent }) };
};

export const handler = schedule('0 12 * * *', run);
