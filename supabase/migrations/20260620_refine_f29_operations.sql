-- Separate monthly F29 tax-payment control from the deferred client-billing ledger.
alter table public.f29_periods
  add column if not exists tax_paid boolean not null default false,
  add column if not exists tax_paid_at timestamptz,
  add column if not exists last_payment_reminder_at timestamptz,
  add column if not exists last_payment_reminder_by uuid references public.profiles(id);

update public.f29_periods
set tax_paid = true,
    tax_paid_at = coalesce(tax_paid_at, filed_date::timestamptz)
where status_code = 'D' and not tax_paid;

alter table public.email_logs drop constraint if exists email_logs_message_kind_check;
alter table public.email_logs add constraint email_logs_message_kind_check
  check (message_kind in ('f29_summary', 'f29_payment_reminder', 'payment_reminder'));

insert into public.email_templates (key, name, subject, body_html, active)
values (
  'f29_payment_reminder',
  'Recordatorio pago F29',
  'Recordatorio pago F29 {{month_name}} {{year}} - {{client_name}}',
  '<p>Estimado/a {{client_name}},</p><p>Le recordamos que se encuentra pendiente el pago de su Formulario 29 correspondiente a <strong>{{month_name}} {{year}}</strong>.</p><p>Monto F29: <strong>{{amount}}</strong><br>Vencimiento informado: día {{due_day}}</p><p>Si el pago ya fue realizado, por favor omita este mensaje.</p><p>Saludos cordiales,<br>{{firm_name}}</p>',
  true
)
on conflict (key) do update set
  name = excluded.name,
  subject = excluded.subject,
  body_html = excluded.body_html,
  active = true,
  updated_at = now();

create index if not exists f29_tax_payment_idx
  on public.f29_periods(year, month, tax_paid, last_payment_reminder_at);

create or replace function public.update_f29_admin_observation(p_f29_period_id uuid, p_observation text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_period public.f29_periods; v_is_admin boolean;
begin
  select exists(select 1 from public.profiles where id = v_user and is_active and role = 'admin') into v_is_admin;
  if not v_is_admin then raise exception 'Administrator access required'; end if;
  select * into v_period from public.f29_periods where id = p_f29_period_id for update;
  if not found then raise exception 'F29 period not found'; end if;
  update public.f29_periods set observation = nullif(trim(p_observation), ''), updated_at = now() where id = p_f29_period_id;
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (v_period.client_id, v_period.id, v_user, 'f29_admin_observation_updated', 'f29_period', v_period.id::text,
    jsonb_build_object('observation', v_period.observation), jsonb_build_object('observation', nullif(trim(p_observation), '')));
end; $$;

grant execute on function public.update_f29_admin_observation(uuid, text) to authenticated;

create or replace function public.finalize_email_delivery(
  p_log_id uuid,
  p_status public.email_delivery_status,
  p_provider_message_id text default null,
  p_error_message text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_log public.email_logs;
begin
  select * into v_log from public.email_logs where id = p_log_id for update;
  if not found then raise exception 'Email log not found'; end if;
  update public.email_logs set status = p_status, provider_message_id = p_provider_message_id,
    error_message = p_error_message, sent_at = case when p_status = 'sent' then now() else null end
  where id = p_log_id;
  if p_status = 'sent' and v_log.message_kind = 'f29_summary' and v_log.f29_period_id is not null then
    update public.f29_periods set email_status = 'sent', sent_at = now(), sent_by = v_log.sent_by, updated_at = now()
    where id = v_log.f29_period_id;
  elsif p_status = 'sent' and v_log.message_kind = 'f29_payment_reminder' and v_log.f29_period_id is not null then
    update public.f29_periods set last_payment_reminder_at = now(), last_payment_reminder_by = v_log.sent_by, updated_at = now()
    where id = v_log.f29_period_id;
  elsif p_status = 'sent' and v_log.message_kind = 'payment_reminder' and v_log.billing_item_id is not null then
    update public.billing_items set last_reminder_at = now(), updated_at = now() where id = v_log.billing_item_id;
    insert into public.payment_events (billing_item_id, event_type, metadata, created_by)
    values (v_log.billing_item_id, 'reminder_sent', jsonb_build_object('email_log_id', p_log_id), v_log.sent_by);
  end if;
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_log.client_id, v_log.f29_period_id, v_log.sent_by,
    case when p_status <> 'sent' then 'email_send_failed'
         when v_log.message_kind = 'f29_summary' then 'f29_email_sent'
         when v_log.message_kind = 'f29_payment_reminder' then 'f29_payment_reminder_sent'
         else 'payment_reminder_sent' end,
    'email_log', p_log_id::text,
    jsonb_build_object('status', p_status, 'provider_message_id', p_provider_message_id, 'error', p_error_message, 'billing_item_id', v_log.billing_item_id));
end; $$;

revoke all on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) from public, anon, authenticated;
grant execute on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) to service_role;
