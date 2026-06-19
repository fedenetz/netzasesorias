create extension if not exists pgcrypto;

create type public.employee_role as enum ('admin', 'accountant', 'viewer');
create type public.period_kind as enum ('f29', 'f22');
create type public.period_state as enum ('pending', 'in_progress', 'ready', 'filed', 'paid', 'blocked');
create type public.document_kind as enum ('f29', 'rcv', 'bce', 'f22', 'dj_1948', 'dj_1949', 'other');
create type public.f29_status_code as enum ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  role public.employee_role not null default 'viewer',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  rut text unique not null,
  legal_name text not null,
  accounting_code text,
  has_credentials boolean not null default false,
  assigned_user_id uuid references public.profiles(id),
  drive_folder_id text unique,
  f29_enabled boolean not null default true,
  f22_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind public.period_kind not null,
  period_year integer not null check (period_year between 2000 and 2100),
  period_month integer check ((kind = 'f29' and period_month between 1 and 12) or (kind = 'f22' and period_month is null)),
  status public.period_state not null default 'pending',
  assigned_user_id uuid references public.profiles(id),
  due_date date,
  filed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, kind, period_year, period_month)
);

create table public.period_status_fields (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  field_key text not null,
  boolean_value boolean,
  text_value text,
  numeric_value numeric,
  date_value date,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(period_id, field_key),
  check (num_nonnulls(boolean_value, text_value, numeric_value, date_value) <= 1)
);

create table public.f29_periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  amount numeric(16, 0),
  filed_date date,
  status_code public.f29_status_code,
  status_label text,
  due_day integer check (due_day between 1 and 31),
  responsible_user_id uuid references public.profiles(id),
  responsible_name text,
  observation text,
  source_sheet text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, year, month)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  period_id uuid references public.periods(id) on delete set null,
  drive_file_id text unique not null,
  drive_web_view_link text,
  file_name text not null,
  mime_type text,
  document_type public.document_kind not null default 'other',
  processing_status text not null default 'unclassified',
  modified_at timestamptz,
  drive_metadata jsonb not null default '{}'::jsonb,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.f22_periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tax_year integer not null check (tax_year between 2000 and 2100),
  prepared_to_send boolean not null default false,
  sent boolean not null default false,
  saved boolean not null default false,
  refund_amount numeric(16, 0),
  payment_amount numeric(16, 0),
  filed_date date,
  review_status text,
  tax_regime text,
  regime_detail text,
  old_tax_regime text,
  accounting_number text,
  bce_date date,
  bce_status text,
  f22_ready boolean,
  f22_sent boolean,
  dj_1948 boolean,
  dj_1948_sent boolean,
  dj_1949 boolean,
  provisional boolean,
  utility_loss_text text,
  utility_loss_amount numeric(16, 0),
  dividends_text text,
  dividends_amount numeric(16, 0),
  partners text,
  refund_payment_text text,
  observation text,
  responsible_user_id uuid references public.profiles(id),
  responsible_name text,
  source_sheet text,
  source_row integer,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, tax_year)
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  period_id uuid references public.periods(id) on delete cascade,
  f29_period_id uuid references public.f29_periods(id) on delete cascade,
  f22_period_id uuid references public.f22_periods(id) on delete cascade,
  body text not null,
  is_resolved boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  client_id uuid references public.clients(id) on delete cascade,
  period_id uuid references public.periods(id) on delete cascade,
  f29_period_id uuid references public.f29_periods(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index periods_dashboard_idx on public.periods(kind, period_year, period_month, status);
create index f29_dashboard_idx on public.f29_periods(year, month, status_code, responsible_user_id);
create index f22_dashboard_idx on public.f22_periods(tax_year, f22_sent, bce_status, responsible_user_id);
create index clients_assigned_idx on public.clients(assigned_user_id) where is_active;
create index documents_client_idx on public.documents(client_id, modified_at desc);
create index activity_client_idx on public.activity_log(client_id, created_at desc);

create or replace function public.is_active_employee()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and is_active) $$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.periods enable row level security;
alter table public.period_status_fields enable row level security;
alter table public.f29_periods enable row level security;
alter table public.f22_periods enable row level security;
alter table public.documents enable row level security;
alter table public.observations enable row level security;
alter table public.activity_log enable row level security;

create policy "employees read profiles" on public.profiles for select using (public.is_active_employee());
create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "employees read clients" on public.clients for select using (public.is_active_employee());
create policy "employees write clients" on public.clients for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees manage periods" on public.periods for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees manage fields" on public.period_status_fields for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees manage f29 periods" on public.f29_periods for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees manage f22 periods" on public.f22_periods for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees manage documents" on public.documents for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees manage observations" on public.observations for all using (public.is_active_employee()) with check (public.is_active_employee());
create policy "employees read activity" on public.activity_log for select using (public.is_active_employee());
create policy "employees create activity" on public.activity_log for insert with check (public.is_active_employee() and (actor_id is null or actor_id = auth.uid()));

-- New Google users remain inactive until an admin explicitly allows them.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_active)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', false)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
