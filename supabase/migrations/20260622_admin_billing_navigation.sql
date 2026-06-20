-- Employee safelist and the remaining manual billing operations.
-- This migration stores no SII credentials or certificate secrets.

create table if not exists public.employee_email_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role public.employee_role not null default 'accountant',
  is_active boolean not null default true,
  profile_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_email_allowlist_email_lower check (email = lower(trim(email))),
  unique (email)
);

create index if not exists employee_allowlist_active_idx
  on public.employee_email_allowlist(is_active, role, email);

insert into public.employee_email_allowlist (email, full_name, role, is_active, profile_id)
select lower(trim(email)), coalesce(nullif(trim(full_name), ''), split_part(email, '@', 1)), role, is_active, id
from public.profiles
where email is not null and trim(email) <> ''
on conflict (email) do update set
  profile_id = excluded.profile_id,
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.employee_email_allowlist enable row level security;
drop policy if exists "admins read employee allowlist" on public.employee_email_allowlist;
create policy "admins read employee allowlist" on public.employee_email_allowlist for select
using (exists (
  select 1 from public.profiles
  where id = auth.uid() and is_active and role = 'admin'
));

create or replace function public.manage_employee_allowlist(
  p_id uuid default null,
  p_email text default '',
  p_full_name text default '',
  p_role public.employee_role default 'accountant',
  p_is_active boolean default true
) returns public.employee_email_allowlist
language plpgsql security definer set search_path = public, auth as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_profile public.profiles;
  v_before public.employee_email_allowlist;
  v_entry public.employee_email_allowlist;
begin
  if not exists(select 1 from public.profiles where id = v_actor and is_active and role = 'admin') then
    raise exception 'Administrator access required';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid employee email is required';
  end if;
  if trim(p_full_name) = '' then raise exception 'Employee name is required'; end if;

  if p_id is not null then select * into v_before from public.employee_email_allowlist where id = p_id; end if;
  select * into v_profile from public.profiles where lower(email) = v_email limit 1;
  if v_profile.id = v_actor and (not p_is_active or p_role <> 'admin') then
    raise exception 'You cannot remove your own administrator access';
  end if;

  insert into public.employee_email_allowlist (id, email, full_name, role, is_active, profile_id, created_by)
  values (coalesce(p_id, gen_random_uuid()), v_email, trim(p_full_name), p_role, p_is_active, v_profile.id, v_actor)
  on conflict (email) do update set
    full_name = excluded.full_name,
    role = excluded.role,
    is_active = excluded.is_active,
    profile_id = coalesce(excluded.profile_id, employee_email_allowlist.profile_id),
    updated_at = now()
  returning * into v_entry;

  if v_profile.id is not null then
    update public.profiles set
      email = v_email,
      full_name = trim(p_full_name),
      role = p_role,
      is_active = p_is_active,
      updated_at = now()
    where id = v_profile.id;
    update public.employee_email_allowlist set profile_id = v_profile.id where id = v_entry.id returning * into v_entry;
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (v_actor, case when v_before.id is null then 'employee_allowlist_created' else 'employee_allowlist_updated' end,
    'employee_email_allowlist', v_entry.id::text, case when v_before.id is null then null else to_jsonb(v_before) end, to_jsonb(v_entry));
  return v_entry;
end; $$;

-- New Google accounts inherit their access only when their email is safelisted.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_allowed public.employee_email_allowlist;
begin
  select * into v_allowed from public.employee_email_allowlist
  where email = lower(trim(new.email)) and is_active limit 1;
  insert into public.profiles (id, email, full_name, avatar_url, role, is_active)
  values (
    new.id,
    lower(trim(new.email)),
    coalesce(v_allowed.full_name, new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(v_allowed.role, 'viewer'::public.employee_role),
    v_allowed.id is not null
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    role = excluded.role,
    is_active = excluded.is_active,
    updated_at = now();
  if v_allowed.id is not null then
    update public.employee_email_allowlist set profile_id = new.id, updated_at = now() where id = v_allowed.id;
  end if;
  return new;
end; $$;

grant execute on function public.manage_employee_allowlist(uuid, text, text, public.employee_role, boolean) to authenticated;

-- Existing rows may predate the expanded event vocabulary.
alter table public.payment_events drop constraint if exists payment_events_event_type_check;
alter table public.payment_events add constraint payment_events_event_type_check
  check (event_type in ('created', 'updated', 'marked_paid', 'marked_unpaid', 'link_created', 'reminder_sent', 'link_disabled'));
