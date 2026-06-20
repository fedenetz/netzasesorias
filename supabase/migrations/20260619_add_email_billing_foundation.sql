-- Communication and billing foundation. No SII credentials or issuing logic lives here.
do $$ begin
  create type public.billing_status as enum ('not_applicable', 'pending', 'sent', 'paid', 'overdue');
exception when duplicate_object then null; end; $$;

do $$ begin
  create type public.email_delivery_status as enum ('not_sent', 'sending', 'sent', 'failed');
exception when duplicate_object then null; end; $$;

alter table public.f29_periods
  add column if not exists email_status public.email_delivery_status not null default 'not_sent',
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by uuid references public.profiles(id),
  add column if not exists billing_status public.billing_status not null default 'not_applicable',
  add column if not exists billing_amount numeric(16, 0),
  add column if not exists billing_due_date date,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_method text,
  add column if not exists payment_notes text;

create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  email text not null,
  contact_type text not null default 'general' check (contact_type in ('general', 'billing', 'legal', 'operations')),
  is_billing boolean not null default false,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, email)
);

create unique index if not exists client_contacts_one_primary_idx
  on public.client_contacts(client_id) where is_primary and is_active;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  subject text not null,
  body_html text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.email_templates (key, name, subject, body_html)
values
  ('f29_monthly_summary', 'Resumen mensual F29', 'Formulario 29 {{month_name}} {{year}} - {{client_name}}',
   '<p>Estimado/a {{client_name}},</p><p>Adjuntamos el resumen de su Formulario 29 correspondiente a <strong>{{month_name}} {{year}}</strong>.</p><p>Monto declarado: <strong>{{amount}}</strong><br>Fecha de declaración: {{filed_date}}<br>Estado: {{payment_status}}</p><p>Saludos cordiales,<br>{{firm_name}}</p>'),
  ('payment_reminder', 'Recordatorio de pago', 'Recordatorio de pago - {{service_period}} - {{client_name}}',
   '<p>Estimado/a {{client_name}},</p><p>Le recordamos que se encuentra pendiente el pago de <strong>{{billing_amount}}</strong> por {{service_period}}, con vencimiento {{due_date}}.</p><p>Estado: {{billing_status}}</p><p>Saludos cordiales,<br>{{firm_name}}</p>')
on conflict (key) do update set
  name = excluded.name,
  subject = excluded.subject,
  body_html = excluded.body_html,
  updated_at = now();

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  default_amount numeric(16, 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.services (key, name, description)
values ('f29_monthly', 'Servicio mensual F29', 'Preparación y gestión mensual del Formulario 29')
on conflict (key) do nothing;

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_id uuid not null references public.services(id),
  cadence text not null default 'monthly' check (cadence in ('monthly', 'annual', 'one_time')),
  agreed_amount numeric(16, 0),
  active boolean not null default true,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, service_id)
);

insert into public.client_services (client_id, service_id)
select c.id, s.id from public.clients c cross join public.services s
where c.f29_enabled and s.key = 'f29_monthly'
on conflict (client_id, service_id) do nothing;

create table if not exists public.billing_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  client_service_id uuid references public.client_services(id) on delete set null,
  f29_period_id uuid unique references public.f29_periods(id) on delete set null,
  description text not null,
  period_year integer check (period_year between 2000 and 2100),
  period_month integer check (period_month between 1 and 12),
  amount numeric(16, 0) not null check (amount >= 0),
  currency text not null default 'CLP' check (currency = 'CLP'),
  due_date date,
  status public.billing_status not null default 'pending',
  paid_at timestamptz,
  payment_method text,
  notes text,
  last_reminder_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid' and paid_at is not null) or status <> 'paid')
);

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  billing_item_id uuid not null references public.billing_items(id) on delete cascade,
  provider text not null default 'manual',
  external_url text not null check (external_url ~ '^https://'),
  status text not null default 'active' check (status in ('active', 'expired', 'used', 'disabled')),
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  billing_item_id uuid not null references public.billing_items(id) on delete cascade,
  payment_link_id uuid references public.payment_links(id) on delete set null,
  event_type text not null check (event_type in ('created', 'updated', 'marked_paid', 'marked_unpaid', 'link_created', 'reminder_sent')),
  amount numeric(16, 0),
  occurred_at timestamptz not null default now(),
  payment_method text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.communication_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  f29_period_id uuid references public.f29_periods(id) on delete cascade,
  source text not null check (source in ('storage', 'drive')),
  document_id uuid references public.documents(id) on delete cascade,
  storage_path text,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((source = 'drive' and document_id is not null and storage_path is null) or
         (source = 'storage' and storage_path is not null and document_id is null))
);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  f29_period_id uuid references public.f29_periods(id) on delete set null,
  billing_item_id uuid references public.billing_items(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  message_kind text not null check (message_kind in ('f29_summary', 'payment_reminder')),
  provider text not null default 'resend',
  provider_message_id text,
  from_email text not null,
  to_emails text[] not null,
  cc_emails text[] not null default '{}',
  subject text not null,
  body_html text not null,
  attachments jsonb not null default '[]'::jsonb,
  status public.email_delivery_status not null default 'sending',
  error_message text,
  sent_at timestamptz,
  sent_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (cardinality(to_emails) > 0)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  billing_item_id uuid references public.billing_items(id) on delete set null,
  provider text,
  sii_document_type text,
  sii_folio text,
  external_id text,
  status text not null default 'placeholder' check (status in ('placeholder', 'draft', 'cancelled')),
  amount numeric(16, 0),
  issued_at timestamptz,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists f29_email_billing_idx on public.f29_periods(year, month, email_status, billing_status);
create index if not exists billing_items_dashboard_idx on public.billing_items(status, due_date, paid_at);
create index if not exists email_logs_client_idx on public.email_logs(client_id, created_at desc);
create index if not exists payment_events_item_idx on public.payment_events(billing_item_id, occurred_at desc);

create or replace function public.sync_f29_billing_from_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.f29_period_id is not null then
    update public.f29_periods set
      billing_status = new.status,
      billing_amount = new.amount,
      billing_due_date = new.due_date,
      paid_at = new.paid_at,
      payment_method = new.payment_method,
      payment_notes = new.notes,
      updated_at = now()
    where id = new.f29_period_id;
  end if;
  return new;
end; $$;

drop trigger if exists billing_item_sync_f29 on public.billing_items;
create trigger billing_item_sync_f29 after insert or update on public.billing_items
for each row execute procedure public.sync_f29_billing_from_item();

create or replace function public.upsert_f29_billing(
  p_f29_period_id uuid,
  p_amount numeric,
  p_due_date date default null,
  p_status public.billing_status default 'pending',
  p_payment_method text default null,
  p_notes text default null,
  p_paid_at timestamptz default null
) returns public.billing_items
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_period public.f29_periods; v_item public.billing_items; v_service uuid;
begin
  if not public.can_operate() then raise exception 'Operator access required'; end if;
  select * into v_period from public.f29_periods where id = p_f29_period_id;
  if not found then raise exception 'F29 period not found'; end if;
  select cs.id into v_service from public.client_services cs join public.services s on s.id = cs.service_id
    where cs.client_id = v_period.client_id and s.key = 'f29_monthly' limit 1;
  insert into public.billing_items (client_id, client_service_id, f29_period_id, description, period_year, period_month, amount, due_date, status, paid_at, payment_method, notes, created_by)
  values (v_period.client_id, v_service, v_period.id, 'Servicio F29 ' || lpad(v_period.month::text, 2, '0') || '/' || v_period.year, v_period.year, v_period.month, greatest(coalesce(p_amount, 0), 0), p_due_date, p_status, case when p_status = 'paid' then coalesce(p_paid_at, now()) else null end, p_payment_method, p_notes, v_user)
  on conflict (f29_period_id) do update set amount = excluded.amount, due_date = excluded.due_date, status = excluded.status,
    paid_at = excluded.paid_at, payment_method = excluded.payment_method, notes = excluded.notes, updated_at = now()
  returning * into v_item;
  insert into public.payment_events (billing_item_id, event_type, amount, payment_method, metadata, created_by)
  values (v_item.id, case when p_status = 'paid' then 'marked_paid' else 'updated' end, v_item.amount, v_item.payment_method, jsonb_build_object('f29_period_id', p_f29_period_id), v_user);
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_period.client_id, v_period.id, v_user, 'billing_item_updated', 'billing_item', v_item.id::text, to_jsonb(v_item));
  return v_item;
end; $$;

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
  elsif p_status = 'sent' and v_log.message_kind = 'payment_reminder' and v_log.billing_item_id is not null then
    update public.billing_items set last_reminder_at = now(), updated_at = now() where id = v_log.billing_item_id;
    insert into public.payment_events (billing_item_id, event_type, metadata, created_by)
    values (v_log.billing_item_id, 'reminder_sent', jsonb_build_object('email_log_id', p_log_id), v_log.sent_by);
  end if;
  insert into public.activity_log (client_id, f29_period_id, actor_id, action, entity_type, entity_id, after_data)
  values (v_log.client_id, v_log.f29_period_id, v_log.sent_by,
    case when p_status = 'sent' then case when v_log.message_kind = 'payment_reminder' then 'payment_reminder_sent' else 'f29_email_sent' end else 'email_send_failed' end,
    'email_log', p_log_id::text,
    jsonb_build_object('status', p_status, 'provider_message_id', p_provider_message_id, 'error', p_error_message, 'billing_item_id', v_log.billing_item_id));
end; $$;

create or replace function public.save_client_contact(
  p_client_id uuid,
  p_id uuid default null,
  p_name text default '',
  p_email text default '',
  p_contact_type text default 'general',
  p_is_billing boolean default false,
  p_is_primary boolean default false,
  p_is_active boolean default true
) returns public.client_contacts
language plpgsql security definer set search_path = public as $$
declare v_contact public.client_contacts;
begin
  if not public.can_operate() then raise exception 'Operator access required'; end if;
  if trim(p_name) = '' or trim(p_email) = '' then raise exception 'Name and email are required'; end if;
  if p_contact_type not in ('general', 'billing', 'legal', 'operations') then raise exception 'Invalid contact type'; end if;
  if p_is_primary then update public.client_contacts set is_primary = false, updated_at = now() where client_id = p_client_id and id is distinct from p_id; end if;
  if p_id is null then
    insert into public.client_contacts (client_id, name, email, contact_type, is_billing, is_primary, is_active)
    values (p_client_id, trim(p_name), lower(trim(p_email)), p_contact_type, p_is_billing, p_is_primary, p_is_active)
    returning * into v_contact;
  else
    update public.client_contacts set name = trim(p_name), email = lower(trim(p_email)), contact_type = p_contact_type,
      is_billing = p_is_billing, is_primary = p_is_primary, is_active = p_is_active, updated_at = now()
    where id = p_id and client_id = p_client_id returning * into v_contact;
  end if;
  if v_contact.id is null then raise exception 'Contact not found'; end if;
  insert into public.activity_log (client_id, actor_id, action, entity_type, entity_id, after_data)
  values (p_client_id, auth.uid(), case when p_id is null then 'client_contact_created' else 'client_contact_updated' end, 'client_contact', v_contact.id::text, to_jsonb(v_contact));
  return v_contact;
end; $$;

-- Browser clients can read operational data. Writes use audited RPCs or backend functions.
alter table public.client_contacts enable row level security;
alter table public.email_templates enable row level security;
alter table public.services enable row level security;
alter table public.client_services enable row level security;
alter table public.billing_items enable row level security;
alter table public.payment_links enable row level security;
alter table public.payment_events enable row level security;
alter table public.communication_files enable row level security;
alter table public.email_logs enable row level security;
alter table public.invoices enable row level security;

do $$ declare t text; begin
  foreach t in array array['client_contacts','email_templates','services','client_services','billing_items','payment_links','payment_events','communication_files','email_logs','invoices'] loop
    execute format('drop policy if exists "employees read %s" on public.%I', t, t);
    execute format('create policy "employees read %s" on public.%I for select using (public.can_view())', t, t);
  end loop;
end; $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('email-attachments', 'email-attachments', false, 10485760,
  array['application/pdf','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "employees read email attachments" on storage.objects;
create policy "employees read email attachments" on storage.objects for select
using (bucket_id = 'email-attachments' and public.can_view());

grant execute on function public.upsert_f29_billing(uuid, numeric, date, public.billing_status, text, text, timestamptz) to authenticated;
grant execute on function public.save_client_contact(uuid, uuid, text, text, text, boolean, boolean, boolean) to authenticated;
revoke all on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) from public, anon, authenticated;
grant execute on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) to service_role;
