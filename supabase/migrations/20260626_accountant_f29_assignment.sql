begin;

-- F29 imports historically store the operational assignee as responsible_name.
-- Keep RLS aligned with the profile/allowlist name used to link employee accounts.
create or replace function public.can_edit_f29_assignment(
  target_client_id uuid,
  target_responsible_user_id uuid,
  target_responsible_name text
)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles p
    join public.employee_email_allowlist a
      on a.is_active and (a.profile_id = p.id or lower(a.email) = lower(p.email))
    where p.id = auth.uid()
      and p.is_active
      and p.role = 'accountant'::public.employee_role
      and a.role = 'accountant'::public.employee_role
      and (
        target_responsible_user_id = p.id
        or exists (
          select 1 from public.clients c
          where c.id = target_client_id and c.assigned_user_id = p.id
        )
        or translate(lower(trim(coalesce(target_responsible_name, ''))), 'áéíóúüñ', 'aeiouun')
          = translate(lower(trim(coalesce(a.full_name, p.full_name, ''))), 'áéíóúüñ', 'aeiouun')
      )
  )
$$;

revoke all on function public.can_edit_f29_assignment(uuid, uuid, text) from public, anon;
grant execute on function public.can_edit_f29_assignment(uuid, uuid, text) to authenticated, service_role;

drop policy if exists "assigned insert f29 periods" on public.f29_periods;
drop policy if exists "assigned update f29 periods" on public.f29_periods;
drop policy if exists "assigned delete f29 periods" on public.f29_periods;
create policy "assigned insert f29 periods" on public.f29_periods for insert
  with check (public.can_edit_f29_assignment(client_id, responsible_user_id, responsible_name));
create policy "assigned update f29 periods" on public.f29_periods for update
  using (public.can_edit_f29_assignment(client_id, responsible_user_id, responsible_name))
  with check (public.can_edit_f29_assignment(client_id, responsible_user_id, responsible_name));
create policy "assigned delete f29 periods" on public.f29_periods for delete
  using (public.can_edit_f29_assignment(client_id, responsible_user_id, responsible_name));

commit;
