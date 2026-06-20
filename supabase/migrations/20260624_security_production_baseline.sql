-- Sprint 1: authoritative authorization, RLS/RPC hardening and read-only production checks.

create or replace function public.can_view()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.employee_email_allowlist a
      on a.is_active
     and (a.profile_id = p.id or lower(a.email) = lower(p.email))
    where p.id = auth.uid() and p.is_active
  )
$$;

create or replace function public.can_operate()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.employee_email_allowlist a
      on a.is_active
     and (a.profile_id = p.id or lower(a.email) = lower(p.email))
    where p.id = auth.uid() and p.is_active
      and p.role in ('admin'::public.employee_role, 'accountant'::public.employee_role)
      and a.role in ('admin'::public.employee_role, 'accountant'::public.employee_role)
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.employee_email_allowlist a
      on a.is_active
     and (a.profile_id = p.id or lower(a.email) = lower(p.email))
    where p.id = auth.uid() and p.is_active
      and p.role = 'admin'::public.employee_role
      and a.role = 'admin'::public.employee_role
  )
$$;

create or replace function public.is_active_employee()
returns boolean language sql stable security definer set search_path = public
as $$ select public.can_view() $$;

revoke all on function public.can_view() from public, anon;
revoke all on function public.can_operate() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.can_view() to authenticated, service_role;
grant execute on function public.can_operate() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- Rebuild public-table policies so no mutation is authorized by employee activity alone.
do $$
declare t text; p record;
begin
  foreach t in array array[
    'clients','periods','period_status_fields','f29_periods','f22_periods','documents',
    'observations','activity_log','client_contacts','email_templates','services',
    'client_services','billing_items','payment_links','payment_events',
    'communication_files','email_logs','invoices','chile_holidays'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy %I on public.%I for select using (public.can_view())', 'authorized read ' || t, t);
    execute format('create policy %I on public.%I for insert with check (public.can_operate())', 'operators insert ' || t, t);
    execute format('create policy %I on public.%I for update using (public.can_operate()) with check (public.can_operate())', 'operators update ' || t, t);
    execute format('create policy %I on public.%I for delete using (public.can_operate())', 'operators delete ' || t, t);
  end loop;
end $$;

-- Profiles and safelist are settings surfaces: readable internally, mutable only through admin RPCs.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end $$;
create policy "authorized read profiles" on public.profiles for select using (public.can_view());
create policy "users read own profile" on public.profiles for select using (id = auth.uid());

do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'employee_email_allowlist' loop
    execute format('drop policy %I on public.employee_email_allowlist', p.policyname);
  end loop;
end $$;
create policy "admins read employee allowlist" on public.employee_email_allowlist for select using (public.is_admin());

-- Storage is private. Operators upload/remove; all authorized roles may download.
drop policy if exists "employees read email attachments" on storage.objects;
drop policy if exists "authorized read email attachments" on storage.objects;
drop policy if exists "operators insert email attachments" on storage.objects;
drop policy if exists "operators update email attachments" on storage.objects;
drop policy if exists "operators delete email attachments" on storage.objects;
create policy "authorized read email attachments" on storage.objects for select
  using (bucket_id = 'email-attachments' and public.can_view());
create policy "operators insert email attachments" on storage.objects for insert
  with check (bucket_id = 'email-attachments' and public.can_operate());
create policy "operators update email attachments" on storage.objects for update
  using (bucket_id = 'email-attachments' and public.can_operate())
  with check (bucket_id = 'email-attachments' and public.can_operate());
create policy "operators delete email attachments" on storage.objects for delete
  using (bucket_id = 'email-attachments' and public.can_operate());

create or replace function public.upsert_f29_billing(
  p_f29_period_id uuid, p_amount numeric, p_due_date date default null,
  p_status public.billing_status default 'pending', p_payment_method text default null,
  p_notes text default null, p_paid_at timestamptz default null
) returns public.billing_items
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_period public.f29_periods; v_item public.billing_items; v_service uuid;
begin
  if not public.can_operate() then raise exception 'Operator access required' using errcode = '42501'; end if;
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
end $$;

create or replace function public.save_client_contact(
  p_client_id uuid, p_id uuid default null, p_name text default '', p_email text default '',
  p_contact_type text default 'general', p_is_billing boolean default false,
  p_is_primary boolean default false, p_is_active boolean default true
) returns public.client_contacts
language plpgsql security definer set search_path = public as $$
declare v_contact public.client_contacts;
begin
  if not public.can_operate() then raise exception 'Operator access required' using errcode = '42501'; end if;
  if trim(p_name) = '' or trim(p_email) = '' then raise exception 'Name and email are required'; end if;
  if p_contact_type not in ('general', 'billing', 'legal', 'operations') then raise exception 'Invalid contact type'; end if;
  if p_is_primary then update public.client_contacts set is_primary = false, updated_at = now() where client_id = p_client_id and id is distinct from p_id; end if;
  if p_id is null then
    insert into public.client_contacts (client_id, name, email, contact_type, is_billing, is_primary, is_active)
    values (p_client_id, trim(p_name), lower(trim(p_email)), p_contact_type, p_is_billing, p_is_primary, p_is_active) returning * into v_contact;
  else
    update public.client_contacts set name = trim(p_name), email = lower(trim(p_email)), contact_type = p_contact_type,
      is_billing = p_is_billing, is_primary = p_is_primary, is_active = p_is_active, updated_at = now()
    where id = p_id and client_id = p_client_id returning * into v_contact;
  end if;
  if v_contact.id is null then raise exception 'Contact not found'; end if;
  insert into public.activity_log (client_id, actor_id, action, entity_type, entity_id, after_data)
  values (p_client_id, auth.uid(), case when p_id is null then 'client_contact_created' else 'client_contact_updated' end, 'client_contact', v_contact.id::text, to_jsonb(v_contact));
  return v_contact;
end $$;

create or replace function public.manage_employee_allowlist(
  p_id uuid default null, p_email text default '', p_full_name text default '',
  p_role public.employee_role default 'accountant', p_is_active boolean default true
) returns public.employee_email_allowlist
language plpgsql security definer set search_path = public, auth as $$
declare
  v_actor uuid := auth.uid(); v_email text := lower(trim(p_email)); v_profile public.profiles;
  v_before public.employee_email_allowlist; v_entry public.employee_email_allowlist;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid employee email is required'; end if;
  if trim(p_full_name) = '' then raise exception 'Employee name is required'; end if;
  if p_id is not null then select * into v_before from public.employee_email_allowlist where id = p_id; end if;
  select * into v_profile from public.profiles where lower(email) = v_email limit 1;
  if v_profile.id = v_actor and (not p_is_active or p_role <> 'admin') then raise exception 'You cannot remove your own administrator access'; end if;
  insert into public.employee_email_allowlist (id,email,full_name,role,is_active,profile_id,created_by)
  values (coalesce(p_id,gen_random_uuid()),v_email,trim(p_full_name),p_role,p_is_active,v_profile.id,v_actor)
  on conflict (email) do update set full_name=excluded.full_name,role=excluded.role,is_active=excluded.is_active,
    profile_id=coalesce(excluded.profile_id,employee_email_allowlist.profile_id),updated_at=now()
  returning * into v_entry;
  if v_profile.id is not null then
    update public.profiles set email=v_email,full_name=trim(p_full_name),role=p_role,is_active=p_is_active,updated_at=now() where id=v_profile.id;
    update public.employee_email_allowlist set profile_id=v_profile.id where id=v_entry.id returning * into v_entry;
  end if;
  insert into public.activity_log(actor_id,action,entity_type,entity_id,before_data,after_data)
  values(v_actor,case when v_before.id is null then 'employee_allowlist_created' else 'employee_allowlist_updated' end,
    'employee_email_allowlist',v_entry.id::text,case when v_before.id is null then null else to_jsonb(v_before) end,to_jsonb(v_entry));
  return v_entry;
end $$;

revoke all on function public.upsert_f29_billing(uuid, numeric, date, public.billing_status, text, text, timestamptz) from public, anon;
revoke all on function public.save_client_contact(uuid, uuid, text, text, text, boolean, boolean, boolean) from public, anon;
grant execute on function public.upsert_f29_billing(uuid, numeric, date, public.billing_status, text, text, timestamptz) to authenticated;
grant execute on function public.save_client_contact(uuid, uuid, text, text, text, boolean, boolean, boolean) to authenticated;
revoke all on function public.manage_employee_allowlist(uuid, text, text, public.employee_role, boolean) from public, anon;
grant execute on function public.manage_employee_allowlist(uuid, text, text, public.employee_role, boolean) to authenticated;

create or replace function public.update_f29_admin_observation(p_f29_period_id uuid, p_observation text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_period public.f29_periods;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  select * into v_period from public.f29_periods where id=p_f29_period_id for update;
  if not found then raise exception 'F29 period not found'; end if;
  update public.f29_periods set observation=nullif(trim(p_observation),''),updated_at=now() where id=p_f29_period_id;
  insert into public.activity_log(client_id,f29_period_id,actor_id,action,entity_type,entity_id,before_data,after_data)
  values(v_period.client_id,v_period.id,v_user,'f29_admin_observation_updated','f29_period',v_period.id::text,
    jsonb_build_object('observation',v_period.observation),jsonb_build_object('observation',nullif(trim(p_observation),'')));
end $$;
revoke all on function public.update_f29_admin_observation(uuid, text) from public, anon;
grant execute on function public.update_f29_admin_observation(uuid, text) to authenticated;

-- Read-only catalog report. The local verifier combines this with env/function checks.
create or replace function public.production_readiness_report()
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare
  required_tables text[] := array['profiles','clients','f29_periods','f22_periods','documents','client_contacts','billing_items','payment_events','communication_files','email_logs','employee_email_allowlist'];
  operational_tables text[] := array['clients','f29_periods','f22_periods','documents','client_contacts','billing_items','payment_events','communication_files','email_logs'];
  required_rpcs text[] := array['is_admin','can_operate','can_view','upsert_f29_billing','save_client_contact','manage_employee_allowlist','finalize_email_delivery','mark_email_scheduled'];
  required_columns text[] := array['profiles.role','profiles.is_active','clients.drive_folder_id','f29_periods.email_status','f29_periods.tax_paid','f22_periods.tax_year','documents.client_id','email_logs.provider_message_id','email_logs.scheduled_at','billing_items.status'];
  required_enums text[] := array['employee_role','document_kind','billing_status','email_delivery_status'];
  required_triggers text[] := array['on_auth_user_created','billing_item_sync_f29','f29_set_payment_due_date'];
  required_versions text[] := array['20260618','20260619','20260620','20260621','20260622','20260623','20260624'];
  missing_tables text[]; missing_rpcs text[]; missing_columns text[]; missing_enums text[];
  missing_triggers text[]; missing_versions text[] := '{}'; rls_missing text[]; bucket_private boolean;
  policy_tables_missing text[]; rpc_grants_missing text[]; unsafe_grants text[];
begin
  select coalesce(array_agg(x), '{}') into missing_tables from unnest(required_tables) x where to_regclass('public.' || x) is null;
  select coalesce(array_agg(x), '{}') into missing_rpcs from unnest(required_rpcs) x
    where not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=x);
  select coalesce(array_agg(x), '{}') into rls_missing from unnest(required_tables) x
    where exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=x and not c.relrowsecurity);
  select coalesce(array_agg(x), '{}') into missing_columns from unnest(required_columns) x
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema='public' and c.table_name=split_part(x,'.',1) and c.column_name=split_part(x,'.',2)
    );
  select coalesce(array_agg(x), '{}') into missing_enums from unnest(required_enums) x
    where not exists (select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname=x and t.typtype='e');
  select coalesce(array_agg(x), '{}') into missing_triggers from unnest(required_triggers) x
    where not exists (select 1 from pg_trigger where tgname=x and not tgisinternal);
  select coalesce(array_agg(x), '{}') into policy_tables_missing from unnest(operational_tables) x
    where not exists (select 1 from pg_policies where schemaname='public' and tablename=x and cmd='SELECT')
       or not exists (select 1 from pg_policies where schemaname='public' and tablename=x and cmd='INSERT')
       or not exists (select 1 from pg_policies where schemaname='public' and tablename=x and cmd='UPDATE')
       or not exists (select 1 from pg_policies where schemaname='public' and tablename=x and cmd='DELETE');
  select coalesce(array_agg(x), '{}') into rpc_grants_missing from unnest(required_rpcs) x
    where not exists (
      select 1 from information_schema.routine_privileges rp
      where rp.specific_schema='public' and rp.routine_name=x and rp.privilege_type='EXECUTE'
    );
  select coalesce(array_agg(distinct rp.routine_name || ':' || rp.grantee), '{}') into unsafe_grants
    from information_schema.routine_privileges rp
    where rp.specific_schema='public'
      and rp.routine_name in ('finalize_email_delivery','mark_email_scheduled','production_readiness_report')
      and rp.grantee in ('PUBLIC','anon','authenticated');
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(array_agg(v), ''{}'') from unnest($1) v where not exists (select 1 from supabase_migrations.schema_migrations m where m.version::text = v)'
      into missing_versions using required_versions;
  else
    missing_versions := required_versions;
  end if;
  select (not public) into bucket_private from storage.buckets where id='email-attachments';
  return jsonb_build_object(
    'migrations', jsonb_build_object('pass', cardinality(missing_versions)=0, 'missing_versions', missing_versions),
    'tables', jsonb_build_object('pass', cardinality(missing_tables)=0, 'missing', missing_tables),
    'columns', jsonb_build_object('pass', cardinality(missing_columns)=0, 'missing', missing_columns),
    'enums', jsonb_build_object('pass', cardinality(missing_enums)=0, 'missing', missing_enums),
    'rpcs', jsonb_build_object('pass', cardinality(missing_rpcs)=0, 'missing', missing_rpcs),
    'rls', jsonb_build_object('pass', cardinality(rls_missing)=0, 'missing', rls_missing),
    'policies', jsonb_build_object('pass', cardinality(policy_tables_missing)=0, 'missing', policy_tables_missing),
    'triggers', jsonb_build_object('pass', cardinality(missing_triggers)=0, 'missing', missing_triggers),
    'grants', jsonb_build_object('pass', cardinality(rpc_grants_missing)=0 and cardinality(unsafe_grants)=0, 'missing', rpc_grants_missing, 'unsafe', unsafe_grants),
    'storage', jsonb_build_object('pass', coalesce(bucket_private,false), 'email_attachments_private', coalesce(bucket_private,false))
  );
end $$;
revoke all on function public.production_readiness_report() from public, anon, authenticated;
grant execute on function public.production_readiness_report() to service_role;

-- Reconciliation is idempotent: repeated provider observations cannot duplicate side effects.
create or replace function public.finalize_email_delivery(
  p_log_id uuid, p_status public.email_delivery_status,
  p_provider_message_id text default null, p_error_message text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_log public.email_logs;
begin
  select * into v_log from public.email_logs where id = p_log_id for update;
  if not found then raise exception 'Email log not found'; end if;
  if v_log.status = p_status and (p_status <> 'sent' or v_log.sent_at is not null) then return; end if;
  if v_log.status = 'sent' and p_status <> 'sent' then return; end if;
  update public.email_logs set status = p_status, provider_message_id = coalesce(p_provider_message_id, provider_message_id),
    error_message = p_error_message, sent_at = case when p_status = 'sent' then coalesce(sent_at, now()) else null end
  where id = p_log_id;
  if p_status = 'sent' and v_log.message_kind = 'f29_summary' and v_log.f29_period_id is not null then
    update public.f29_periods set email_status = 'sent', sent_at = coalesce(sent_at, now()), sent_by = v_log.sent_by,
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
    case when p_status <> 'sent' then 'email_send_failed' when v_log.message_kind = 'f29_summary' then 'f29_email_sent'
         when v_log.message_kind = 'f29_payment_reminder' then 'f29_payment_reminder_sent' else 'payment_reminder_sent' end,
    'email_log', p_log_id::text,
    jsonb_build_object('status', p_status, 'provider_message_id', coalesce(p_provider_message_id, v_log.provider_message_id), 'error', p_error_message, 'billing_item_id', v_log.billing_item_id));
end $$;
revoke all on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) from public, anon, authenticated;
grant execute on function public.finalize_email_delivery(uuid, public.email_delivery_status, text, text) to service_role;
