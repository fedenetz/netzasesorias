begin;

create or replace function public.can_edit_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.clients c
    join public.profiles p on p.id = auth.uid()
    where c.id = target_client_id and c.assigned_user_id = auth.uid()
      and p.is_active and p.role = 'accountant'
  )
$$;
revoke all on function public.can_edit_client(uuid) from public, anon;
grant execute on function public.can_edit_client(uuid) to authenticated, service_role;

drop policy if exists "authorized insert clients" on public.clients;
drop policy if exists "authorized update clients" on public.clients;
drop policy if exists "authorized delete clients" on public.clients;
create policy "assigned insert clients" on public.clients for insert with check (public.is_admin());
create policy "assigned update clients" on public.clients for update
  using (public.can_edit_client(id)) with check (public.can_edit_client(id));
create policy "assigned delete clients" on public.clients for delete using (public.is_admin());

drop policy if exists "authorized insert f29_periods" on public.f29_periods;
drop policy if exists "authorized update f29_periods" on public.f29_periods;
drop policy if exists "authorized delete f29_periods" on public.f29_periods;
create policy "assigned insert f29 periods" on public.f29_periods for insert with check (public.can_edit_client(client_id));
create policy "assigned update f29 periods" on public.f29_periods for update using (public.can_edit_client(client_id)) with check (public.can_edit_client(client_id));
create policy "assigned delete f29 periods" on public.f29_periods for delete using (public.can_edit_client(client_id));

drop policy if exists "authorized insert documents" on public.documents;
drop policy if exists "authorized update documents" on public.documents;
drop policy if exists "authorized delete documents" on public.documents;
create policy "assigned insert documents" on public.documents for insert with check (public.can_edit_client(client_id));
create policy "assigned update documents" on public.documents for update using (public.can_edit_client(client_id)) with check (public.can_edit_client(client_id));
create policy "assigned delete documents" on public.documents for delete using (public.can_edit_client(client_id));

drop policy if exists "authorized insert observations" on public.observations;
drop policy if exists "authorized update observations" on public.observations;
drop policy if exists "authorized delete observations" on public.observations;
create policy "assigned insert observations" on public.observations for insert with check (public.can_edit_client(client_id));
create policy "assigned update observations" on public.observations for update using (public.can_edit_client(client_id)) with check (public.can_edit_client(client_id));
create policy "assigned delete observations" on public.observations for delete using (public.can_edit_client(client_id));

commit;
