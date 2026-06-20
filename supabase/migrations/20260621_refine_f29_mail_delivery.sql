-- F29 operational deadlines and scheduled email delivery.
alter table public.f29_periods add column if not exists tax_payment_due_date date;
alter table public.email_logs add column if not exists scheduled_at timestamptz;

update public.email_templates set
  body_html = '<p>Estimado/a {{client_name}},</p><p>Adjuntamos el resumen de su Formulario 29 correspondiente a <strong>{{month_name}} {{year}}</strong>.</p><p>Monto declarado: <strong>{{amount}}</strong><br>Fecha informada: {{filed_date}}<br>Fecha límite de pago: <strong>{{payment_due_date}}</strong><br>Estado: {{payment_status}}</p><p>Saludos cordiales,<br>{{firm_name}}</p>',
  updated_at = now()
where key = 'f29_monthly_summary';

create table if not exists public.chile_holidays (
  holiday_date date primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.chile_holidays (holiday_date, name) values
  ('2026-01-01','Año Nuevo'),('2026-04-03','Viernes Santo'),('2026-04-04','Sábado Santo'),
  ('2026-05-01','Día del Trabajo'),('2026-05-21','Glorias Navales'),('2026-06-21','Día Nacional de los Pueblos Indígenas'),
  ('2026-06-29','San Pedro y San Pablo'),('2026-07-16','Virgen del Carmen'),('2026-08-15','Asunción de la Virgen'),
  ('2026-09-18','Independencia Nacional'),('2026-09-19','Glorias del Ejército'),('2026-10-12','Encuentro de Dos Mundos'),
  ('2026-10-31','Día de las Iglesias Evangélicas'),('2026-11-01','Todos los Santos'),('2026-12-08','Inmaculada Concepción'),('2026-12-25','Navidad'),
  ('2027-01-01','Año Nuevo'),('2027-03-26','Viernes Santo'),('2027-03-27','Sábado Santo'),
  ('2027-05-01','Día del Trabajo'),('2027-05-21','Glorias Navales'),('2027-06-21','Día Nacional de los Pueblos Indígenas'),
  ('2027-06-28','San Pedro y San Pablo'),('2027-07-16','Virgen del Carmen'),('2027-08-15','Asunción de la Virgen'),
  ('2027-09-18','Independencia Nacional'),('2027-09-19','Glorias del Ejército'),('2027-10-11','Encuentro de Dos Mundos'),
  ('2027-10-31','Día de las Iglesias Evangélicas'),('2027-11-01','Todos los Santos'),('2027-12-08','Inmaculada Concepción'),('2027-12-25','Navidad')
on conflict (holiday_date) do update set name = excluded.name;

alter table public.chile_holidays enable row level security;
drop policy if exists "employees read chile holidays" on public.chile_holidays;
create policy "employees read chile holidays" on public.chile_holidays for select using (public.is_active_employee());

create or replace function public.next_chile_business_date(p_date date)
returns date language plpgsql stable security definer set search_path = public as $$
declare v_date date := p_date;
begin
  while extract(isodow from v_date) in (6,7) or exists(select 1 from public.chile_holidays where holiday_date = v_date) loop
    v_date := v_date + 1;
  end loop;
  return v_date;
end; $$;

create or replace function public.f29_electronic_payment_due_date(p_year integer, p_month integer)
returns date language plpgsql stable security definer set search_path = public as $$
declare v_next_month date;
begin
  v_next_month := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  return public.next_chile_business_date(make_date(extract(year from v_next_month)::integer, extract(month from v_next_month)::integer, 20));
end; $$;

create or replace function public.next_chile_business_morning()
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare v_local_date date; v_business_date date;
begin
  v_local_date := (now() at time zone 'America/Santiago')::date;
  v_business_date := public.next_chile_business_date(v_local_date + 1);
  return (v_business_date::text || ' 08:00:00 America/Santiago')::timestamptz;
end; $$;

create or replace function public.set_f29_payment_due_date()
returns trigger language plpgsql set search_path = public as $$
begin
  new.tax_payment_due_date := public.f29_electronic_payment_due_date(new.year, new.month);
  return new;
end; $$;

drop trigger if exists f29_set_payment_due_date on public.f29_periods;
create trigger f29_set_payment_due_date before insert or update of year, month on public.f29_periods
for each row execute procedure public.set_f29_payment_due_date();

update public.f29_periods set tax_payment_due_date = public.f29_electronic_payment_due_date(year, month)
where tax_payment_due_date is null;

create or replace function public.mark_email_scheduled(p_log_id uuid, p_provider_message_id text, p_scheduled_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare v_log public.email_logs;
begin
  select * into v_log from public.email_logs where id = p_log_id for update;
  if not found then raise exception 'Email log not found'; end if;
  update public.email_logs set status = 'sending', provider_message_id = p_provider_message_id, scheduled_at = p_scheduled_at where id = p_log_id;
  if v_log.f29_period_id is not null and v_log.message_kind = 'f29_summary' then
    update public.f29_periods set email_status = 'sending', updated_at = now() where id = v_log.f29_period_id;
  end if;
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_log.client_id, v_log.f29_period_id, v_log.sent_by, 'f29_email_scheduled', 'email_log', p_log_id::text,
    jsonb_build_object('scheduled_at', p_scheduled_at, 'provider_message_id', p_provider_message_id));
end; $$;

revoke all on function public.mark_email_scheduled(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.mark_email_scheduled(uuid, text, timestamptz) to service_role;
grant execute on function public.next_chile_business_morning() to authenticated, service_role;

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
  update public.email_logs set status = p_status, provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error_message = p_error_message, sent_at = case when p_status = 'sent' then now() else null end
  where id = p_log_id;
  if p_status = 'sent' and v_log.message_kind = 'f29_summary' and v_log.f29_period_id is not null then
    update public.f29_periods set email_status = 'sent', sent_at = now(), sent_by = v_log.sent_by,
      filed_date = coalesce(filed_date, (now() at time zone 'America/Santiago')::date), status_code = 'C', status_label = 'Informada', updated_at = now()
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
    jsonb_build_object('status', p_status, 'provider_message_id', coalesce(p_provider_message_id, v_log.provider_message_id), 'error', p_error_message, 'billing_item_id', v_log.billing_item_id));
end; $$;

revoke all on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) from public, anon, authenticated;
grant execute on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) to service_role;
