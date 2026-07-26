-- =========================================================
-- Roles Lider y Jefe + restriccion de ciudad por usuario.
--
-- - profile_cities: ciudades asignadas a un usuario (ej. un Coordinador).
--   Si un usuario NO tiene ninguna fila aqui, no tiene restriccion (ve todo,
--   igual que hoy). Si tiene una o mas, solo ve datos de esas ciudades en
--   Recoleccion, Conciliacion/Tipo de Servicio y Adicionales (via CEDI).
-- - Roles Lider y Jefe: ven todo (sin restriccion de ciudad) y pueden operar
--   el estado de Disponibilidades: Lider aprueba pero no autoriza; Jefe
--   aprueba y autoriza (y puede revertir).
-- =========================================================

-- ---------- Ciudades asignadas a un usuario ----------
create table if not exists public.profile_cities (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  primary key (profile_id, city_id)
);
create index if not exists idx_profile_cities_profile on public.profile_cities (profile_id);

alter table public.profile_cities enable row level security;

drop policy if exists "profile_cities_select" on public.profile_cities;
create policy "profile_cities_select" on public.profile_cities
  for select using (profile_id = auth.uid() or public.has_permission('users.manage'));

drop policy if exists "profile_cities_manage" on public.profile_cities;
create policy "profile_cities_manage" on public.profile_cities
  for all using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

-- Ciudades asignadas al usuario actual (vacio = sin restriccion, ve todo).
create or replace function public.current_user_city_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(city_id), '{}'::uuid[]) from public.profile_cities where profile_id = auth.uid();
$$;

create or replace function public.user_has_city_restriction()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profile_cities where profile_id = auth.uid());
$$;

-- ---------- Recoleccion: agregar restriccion de ciudad ----------
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select using (
    public.has_permission('recoleccion.view')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (
    (public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (
    (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

-- ---------- Conciliacion / Tipo de Servicio: agregar restriccion de ciudad ----------
drop policy if exists "reconciliations_select" on public.reconciliations;
create policy "reconciliations_select" on public.reconciliations
  for select
  using (
    (public.has_permission('conciliacion.view') or public.has_permission('tipo_servicio.view'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "reconciliations_insert" on public.reconciliations;
create policy "reconciliations_insert" on public.reconciliations
  for insert
  with check (
    (
      public.has_permission('conciliacion.create') or public.has_permission('conciliacion.import')
      or public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import')
    )
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "reconciliations_update" on public.reconciliations;
create policy "reconciliations_update" on public.reconciliations
  for update
  using (
    (
      public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
      or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
    )
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    (
      public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
      or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
    )
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

-- ---------- Adicionales: restriccion de ciudad via CEDI (cedi_id -> cedis.city_id) ----------
drop policy if exists "additional_services_select" on public.additional_services;
create policy "additional_services_select" on public.additional_services
  for select using (
    public.has_permission('adicionales.view')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

drop policy if exists "additional_services_insert" on public.additional_services;
create policy "additional_services_insert" on public.additional_services
  for insert
  with check (
    public.has_permission('adicionales.create')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

drop policy if exists "additional_services_update" on public.additional_services;
create policy "additional_services_update" on public.additional_services
  for update
  using (
    public.has_permission('adicionales.edit')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  )
  with check (
    public.has_permission('adicionales.edit')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

drop policy if exists "additional_services_delete" on public.additional_services;
create policy "additional_services_delete" on public.additional_services
  for delete using (
    public.has_permission('adicionales.delete')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

-- ---------- Roles Lider y Jefe ----------
insert into public.roles (name, description) values
  ('Líder', 'Ve todos los registros de todas las ciudades. Puede aprobar disponibilidades, no autorizar.'),
  ('Jefe', 'Ve todos los registros de todas las ciudades. Puede aprobar y autorizar disponibilidades.')
on conflict (name) do nothing;

-- ---------- Permiso separado para autorizar (aprobar ya existia) ----------
insert into public.permissions (code, module, description) values
  ('disponibilidades.authorize', 'disponibilidades', 'Autorizar (y revertir) un registro de disponibilidad; incluye aprobar')
on conflict (code) do nothing;

update public.permissions
set description = 'Aprobar un registro de disponibilidad (de Registrado a Aprobado)'
where code = 'disponibilidades.approve';

-- El permiso disponibilidades.authorize se creo despues del seed original de
-- Administrador ("todos los permisos"), asi que se le otorga explicitamente.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador' and p.code = 'disponibilidades.authorize'
on conflict do nothing;

-- Lider: ver todos los modulos + aprobar disponibilidades.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Líder'
  and (p.code like '%.view' or p.code = 'disponibilidades.approve')
on conflict do nothing;

-- Jefe: igual que Lider, mas autorizar.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Jefe'
  and (p.code like '%.view' or p.code = 'disponibilidades.approve' or p.code = 'disponibilidades.authorize')
on conflict do nothing;

-- ---------- Cambio de estado: aprobar exige "approve" o "authorize";        ----------
-- ---------- autorizar y revertir a "registrado" exigen "authorize".        ----------
create or replace function public.availabilities_bulk_set_status(
  p_ids uuid[],
  p_status text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_status not in ('registrado', 'aprobado', 'autorizado') then
    raise exception 'Estado inválido: %', p_status;
  end if;

  if p_status = 'aprobado' then
    if not (public.has_permission('disponibilidades.approve') or public.has_permission('disponibilidades.authorize')) then
      raise exception 'No tienes permiso para aprobar';
    end if;
  elsif p_status = 'autorizado' then
    if not public.has_permission('disponibilidades.authorize') then
      raise exception 'Solo un Jefe puede autorizar';
    end if;
  elsif p_status = 'registrado' then
    if not public.has_permission('disponibilidades.authorize') then
      raise exception 'Solo un Jefe puede revertir a Registrado';
    end if;
  end if;

  update public.availabilities
  set status = p_status
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
