-- Run only against a disposable/local Supabase database with psql -v ON_ERROR_STOP=1.
-- The transaction rolls back every fixture and mutation.
begin;

do $$
begin
  if to_regprocedure('public.can_view()') is null
     or to_regprocedure('public.can_operate()') is null
     or to_regprocedure('public.is_admin()') is null then
    raise exception using
      errcode = '55000',
      message = 'Security baseline is not installed',
      hint = 'Apply supabase/migrations/20260624_security_production_baseline.sql before running this role matrix.';
  end if;
end $$;

do $$
declare
  admin_id uuid := '10000000-0000-0000-0000-000000000001';
  accountant_id uuid := '10000000-0000-0000-0000-000000000002';
  viewer_id uuid := '10000000-0000-0000-0000-000000000003';
  inactive_id uuid := '10000000-0000-0000-0000-000000000004';
  unsafe_id uuid := '10000000-0000-0000-0000-000000000005';
  test_client_id uuid;
  affected integer;
  candidate text;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (admin_id,'authenticated','authenticated','security-admin@example.test','',now(),'{}','{}',now(),now()),
    (accountant_id,'authenticated','authenticated','security-accountant@example.test','',now(),'{}','{}',now(),now()),
    (viewer_id,'authenticated','authenticated','security-viewer@example.test','',now(),'{}','{}',now(),now()),
    (inactive_id,'authenticated','authenticated','security-inactive@example.test','',now(),'{}','{}',now(),now()),
    (unsafe_id,'authenticated','authenticated','security-unsafe@example.test','',now(),'{}','{}',now(),now())
  on conflict (id) do nothing;

  update public.profiles set role='admin', is_active=true where id=admin_id;
  update public.profiles set role='accountant', is_active=true where id=accountant_id;
  update public.profiles set role='viewer', is_active=true where id=viewer_id;
  update public.profiles set role='accountant', is_active=false where id=inactive_id;
  update public.profiles set role='admin', is_active=true where id=unsafe_id;
  delete from public.employee_email_allowlist where email='security-unsafe@example.test';
  insert into public.employee_email_allowlist(email,full_name,role,is_active,profile_id)
  values
    ('security-admin@example.test','Admin','admin',true,admin_id),
    ('security-accountant@example.test','Accountant','accountant',true,accountant_id),
    ('security-viewer@example.test','Viewer','viewer',true,viewer_id),
    ('security-inactive@example.test','Inactive','accountant',false,inactive_id)
  on conflict(email) do update set role=excluded.role,is_active=excluded.is_active,profile_id=excluded.profile_id;

  -- RLS is bypassed by the database owner. All authorization assertions below must
  -- execute as the same PostgreSQL role used by Supabase API requests.
  execute 'set local role authenticated';

  foreach candidate in array array[admin_id::text,accountant_id::text,viewer_id::text,inactive_id::text,unsafe_id::text] loop
    perform set_config('request.jwt.claims', json_build_object('sub',candidate,'role','authenticated')::text, true);
    if candidate in (admin_id::text,accountant_id::text,viewer_id::text) and not public.can_view() then raise exception '% should view', candidate; end if;
    if candidate in (inactive_id::text,unsafe_id::text) and public.can_view() then raise exception '% must not view', candidate; end if;
    if candidate in (admin_id::text,accountant_id::text) and not public.can_operate() then raise exception '% should operate', candidate; end if;
    if candidate in (viewer_id::text,inactive_id::text,unsafe_id::text) and public.can_operate() then raise exception '% must not operate', candidate; end if;
  end loop;

  -- Accountant can create operational records and call mutation RPCs.
  perform set_config('request.jwt.claims', json_build_object('sub',accountant_id,'role','authenticated')::text, true);
  insert into public.clients(rut,legal_name) values ('99.999.999-9','SECURITY MATRIX CLIENT') returning id into test_client_id;
  perform public.save_client_contact(test_client_id,null,'Security Contact','security-contact@example.test','general',false,false,true);

  -- Admin can mutate operations and use the settings RPC.
  perform set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  update public.clients set legal_name='SECURITY MATRIX CLIENT ADMIN' where id=test_client_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'admin UPDATE was denied'; end if;
  perform public.manage_employee_allowlist(null,'security-new@example.test','Security New','viewer',true);

  -- Viewer can read but cannot INSERT, UPDATE, DELETE, or call a mutation RPC.
  perform set_config('request.jwt.claims', json_build_object('sub',viewer_id,'role','authenticated')::text, true);
  perform 1 from public.clients where id=test_client_id;
  if not found then raise exception 'viewer SELECT was unexpectedly denied'; end if;
  begin
    insert into public.clients(rut,legal_name) values ('88.888.888-8','MUST ROLLBACK');
    raise exception 'viewer INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
  update public.clients set legal_name='VIEWER MUST NOT UPDATE' where id=test_client_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'viewer UPDATE unexpectedly succeeded'; end if;
  delete from public.clients where id=test_client_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'viewer DELETE unexpectedly succeeded'; end if;
  begin
    perform public.save_client_contact(gen_random_uuid(),null,'Viewer','viewer@example.test','general',false,false,true);
    raise exception 'viewer mutation RPC unexpectedly succeeded';
  exception when insufficient_privilege then null; end;

  -- Inactive and non-safelisted identities cannot see internal rows.
  perform set_config('request.jwt.claims', json_build_object('sub',inactive_id,'role','authenticated')::text, true);
  perform 1 from public.clients where id=test_client_id;
  if found then raise exception 'inactive SELECT unexpectedly succeeded'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',unsafe_id,'role','authenticated')::text, true);
  perform 1 from public.clients where id=test_client_id;
  if found then raise exception 'non-safelisted SELECT unexpectedly succeeded'; end if;

  -- Every operational table must expose SELECT through can_view and every mutation through can_operate.
  if exists (
    select 1 from unnest(array['clients','periods','period_status_fields','f29_periods','f22_periods','documents','observations','activity_log','client_contacts','client_services','billing_items','payment_links','payment_events','communication_files','email_logs','invoices']) t
    where not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='SELECT' and p.qual like '%can_view%')
       or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='INSERT' and p.with_check like '%can_operate%')
       or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='UPDATE' and p.qual like '%can_operate%')
       or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='DELETE' and p.qual like '%can_operate%')
  ) then raise exception 'One or more operational policy matrices are incomplete'; end if;
  if exists (
    select 1 from unnest(array['email_templates','services','chile_holidays']) t
    where not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='INSERT' and p.with_check like '%is_admin%')
       or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='UPDATE' and p.qual like '%is_admin%')
       or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='DELETE' and p.qual like '%is_admin%')
  ) then raise exception 'One or more settings tables are writable by non-admin roles'; end if;
end $$;

rollback;
