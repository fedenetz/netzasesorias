begin;

alter table public.f29_periods
  add column if not exists review_status text not null default 'none'
    check (review_status in ('none', 'pending_admin_review', 'approved', 'rejected')),
  add column if not exists review_requested_at timestamptz,
  add column if not exists review_email_log_id uuid references public.email_logs(id) on delete set null,
  add column if not exists client_email_sent_at timestamptz,
  add column if not exists client_email_log_id uuid references public.email_logs(id) on delete set null,
  add column if not exists client_email_recipients text[] not null default '{}',
  add column if not exists client_email_cc text[] not null default '{}',
  add column if not exists client_email_attachments jsonb not null default '[]'::jsonb,
  add column if not exists payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'pending', 'paid')),
  add column if not exists payment_marked_by uuid references public.profiles(id),
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists reminder_type text;

alter table public.email_logs drop constraint if exists email_logs_message_kind_check;
alter table public.email_logs add constraint email_logs_message_kind_check
  check (message_kind in ('f29_summary', 'f29_admin_review', 'f29_payment_reminder', 'payment_reminder'));

create unique index if not exists email_logs_f29_admin_review_once
  on public.email_logs(f29_period_id, message_kind)
  where message_kind = 'f29_admin_review' and status in ('sending', 'sent');

create unique index if not exists email_logs_f29_deadline_reminder_once
  on public.email_logs(f29_period_id, message_kind)
  where message_kind = 'f29_payment_reminder' and status in ('sending', 'sent');

create or replace function public.initialize_f29_month(p_year integer, p_month integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.can_operate() then raise exception 'Operator access required'; end if;
  if p_year not between 2000 and 2100 or p_month not between 1 and 12 then raise exception 'Invalid F29 period'; end if;
  insert into public.f29_periods (client_id, year, month, responsible_user_id, responsible_name, status_code, status_label)
  select c.id, p_year, p_month, c.assigned_user_id, coalesce(p.full_name, 'Sin asignar'), null, 'Sin estado'
  from public.clients c left join public.profiles p on p.id = c.assigned_user_id
  where c.is_active and c.f29_enabled
    and (public.is_admin() or c.assigned_user_id = auth.uid())
  on conflict (client_id, year, month) do nothing;
  get diagnostics v_count = row_count;
  insert into public.activity_log (actor_id, action, entity_type, entity_id, after_data)
  values (auth.uid(), 'f29_month_initialized', 'f29_month', p_year || '-' || lpad(p_month::text, 2, '0'), jsonb_build_object('created', v_count));
  return v_count;
end; $$;
revoke all on function public.initialize_f29_month(integer, integer) from public, anon;
grant execute on function public.initialize_f29_month(integer, integer) to authenticated, service_role;

create or replace function public.mark_f29_tax_payment(p_f29_period_id uuid, p_paid boolean)
returns public.f29_periods language plpgsql security definer set search_path = public as $$
declare v_before public.f29_periods; v_after public.f29_periods;
begin
  select * into v_before from public.f29_periods where id = p_f29_period_id for update;
  if not found or not public.can_edit_f29_assignment(v_before.client_id, v_before.responsible_user_id, v_before.responsible_name) then raise exception 'F29 period not found or forbidden'; end if;
  update public.f29_periods set tax_paid = p_paid, tax_paid_at = case when p_paid then now() else null end,
    payment_status = case when p_paid then 'paid' when email_status = 'sent' then 'pending' else 'not_required' end,
    payment_marked_by = auth.uid(), status_code = case when p_paid then 'D' else case when email_status = 'sent' then 'C' else status_code end end,
    status_label = case when p_paid then 'Pagada' else case when email_status = 'sent' then 'Informada' else status_label end end, updated_at = now()
  where id = p_f29_period_id returning * into v_after;
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, before_data, after_data)
  values (v_after.client_id, v_after.id, auth.uid(), case when p_paid then 'f29_payment_marked_paid' else 'f29_payment_marked_pending' end,
    'f29_period', v_after.id::text, to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end; $$;
revoke all on function public.mark_f29_tax_payment(uuid, boolean) from public, anon;
grant execute on function public.mark_f29_tax_payment(uuid, boolean) to authenticated, service_role;

create or replace function public.finalize_email_delivery(
  p_log_id uuid, p_status public.email_delivery_status, p_provider_message_id text default null, p_error_message text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_log public.email_logs;
begin
  select * into v_log from public.email_logs where id = p_log_id for update;
  if not found then raise exception 'Email log not found'; end if;
  update public.email_logs set status = p_status, provider_message_id = p_provider_message_id, error_message = p_error_message,
    sent_at = case when p_status = 'sent' then now() else null end where id = p_log_id;
  if p_status = 'sent' and v_log.message_kind = 'f29_summary' and v_log.f29_period_id is not null then
    update public.f29_periods set email_status = 'sent', sent_at = now(), sent_by = v_log.sent_by,
      status_code = 'C', status_label = 'Informada', review_status = 'approved', client_email_sent_at = now(),
      client_email_log_id = p_log_id, client_email_recipients = v_log.to_emails, client_email_cc = v_log.cc_emails,
      client_email_attachments = v_log.attachments, payment_status = case when tax_paid then 'paid' else 'pending' end, updated_at = now()
    where id = v_log.f29_period_id;
  elsif p_status = 'sent' and v_log.message_kind = 'f29_admin_review' and v_log.f29_period_id is not null then
    update public.f29_periods set review_status = 'pending_admin_review', review_requested_at = now(), review_email_log_id = p_log_id, updated_at = now()
    where id = v_log.f29_period_id;
  elsif p_status = 'sent' and v_log.message_kind = 'f29_payment_reminder' and v_log.f29_period_id is not null then
    update public.f29_periods set last_payment_reminder_at = now(), reminder_sent_at = now(), reminder_type = 'electronic_deadline_minus_1', updated_at = now()
    where id = v_log.f29_period_id;
  elsif p_status = 'sent' and v_log.message_kind = 'payment_reminder' and v_log.billing_item_id is not null then
    update public.billing_items set last_reminder_at = now(), updated_at = now() where id = v_log.billing_item_id;
    insert into public.payment_events (billing_item_id, event_type, metadata, created_by) values (v_log.billing_item_id, 'reminder_sent', jsonb_build_object('email_log_id', p_log_id), v_log.sent_by);
  end if;
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_log.client_id, v_log.f29_period_id, v_log.sent_by, case when p_status = 'sent' then v_log.message_kind || '_sent' else 'email_send_failed' end,
    'email_log', p_log_id::text, jsonb_build_object('status', p_status, 'provider_message_id', p_provider_message_id, 'error', p_error_message));
end; $$;

commit;
