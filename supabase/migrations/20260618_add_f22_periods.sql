alter table public.clients add column if not exists f29_enabled boolean not null default true;
alter table public.clients add column if not exists f22_enabled boolean not null default false;

create table if not exists public.f22_periods (
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

create index if not exists f22_dashboard_idx on public.f22_periods(tax_year, f22_sent, bce_status, responsible_user_id);
alter table public.f22_periods enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'f22_periods' and policyname = 'employees manage f22 periods') then
    create policy "employees manage f22 periods" on public.f22_periods for all using (public.is_active_employee()) with check (public.is_active_employee());
  end if;
end; $$;

alter table public.activity_log add column if not exists f22_period_id uuid references public.f22_periods(id) on delete cascade;
