-- =========================================================
-- Fase 5 - Tipo de Servicio
-- =========================================================

-- Igual que en Recoleccion/Conciliacion: apuntar a public.profiles(id) en
-- vez de auth.users(id) para poder traer el nombre de "Usuario de registro /
-- modificacion" en una sola consulta.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('service_type_records', 'created_by'),
      ('service_type_records', 'updated_by'),
      ('service_type_records', 'deleted_by')
    ) as x(table_name, column_name)
  loop
    execute format(
      'alter table public.%1$I drop constraint if exists %1$s_%2$s_fkey;
       alter table public.%1$I add constraint %1$s_%2$s_fkey foreign key (%2$I) references public.profiles(id);',
      t.table_name, t.column_name
    );
  end loop;
end;
$$;

-- La insercion (alta manual o carga masiva) debe aceptar tanto a quien
-- puede crear como a quien puede importar.
drop policy if exists "service_type_records_insert" on public.service_type_records;
create policy "service_type_records_insert" on public.service_type_records
  for insert
  with check (public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import'));

-- La eliminacion es logica (UPDATE de deleted_at/deleted_by, no DELETE real).
drop policy if exists "service_type_records_update" on public.service_type_records;
create policy "service_type_records_update" on public.service_type_records
  for update
  using (public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete'))
  with check (public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete'));

-- Totales (cantidad de registros + suma de valor) del conjunto filtrado
-- completo, igual que en los otros modulos.
create or replace function public.service_type_records_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_status text default null
)
returns table (total_count bigint, total_value numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(value), 0)::numeric
  from public.service_type_records s
  where s.deleted_at is null
    and (p_client_id is null or s.client_id = p_client_id)
    and (p_city_id is null or s.city_id = p_city_id)
    and (p_load_type_ids is null or s.load_type_id = any(p_load_type_ids))
    and (p_status is null or s.status = p_status)
    and (p_date_from is null or s.record_date >= p_date_from)
    and (p_date_to is null or s.record_date <= p_date_to)
    and (p_search is null or p_search = '' or s.guide ilike '%' || p_search || '%');
$$;

-- Ids de todos los registros que cumplen los filtros (para "seleccionar
-- todos los N encontrados", no solo los visibles en la pagina).
create or replace function public.service_type_records_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.service_type_records s
  where s.deleted_at is null
    and (p_client_id is null or s.client_id = p_client_id)
    and (p_city_id is null or s.city_id = p_city_id)
    and (p_load_type_ids is null or s.load_type_id = any(p_load_type_ids))
    and (p_status is null or s.status = p_status)
    and (p_date_from is null or s.record_date >= p_date_from)
    and (p_date_to is null or s.record_date <= p_date_to)
    and (p_search is null or p_search = '' or s.guide ilike '%' || p_search || '%');
$$;

-- Solo un Administrador puede revertir un registro de Facturado a No
-- facturado (el resto de roles con tipo_servicio.edit puede facturar, pero
-- no revertir).
insert into public.permissions (code, module, description) values
  ('tipo_servicio.revert', 'tipo_servicio', 'Revertir un registro de Facturado a No facturado')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador' and p.code = 'tipo_servicio.revert'
on conflict do nothing;

-- Cambio masivo de estado. Solo permite "facturar" registros que ya estan
-- "no_facturado" a menos que sea una reversion explicita con motivo, y solo
-- toca las filas que el usuario puede editar (RLS filtra el resto).
create or replace function public.service_type_records_bulk_set_status(
  p_ids uuid[],
  p_status text,
  p_reverted_reason text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_status not in ('facturado', 'no_facturado') then
    raise exception 'Estado invalido: %', p_status;
  end if;

  if p_status = 'no_facturado' then
    if p_reverted_reason is null or trim(p_reverted_reason) = '' then
      raise exception 'Debes indicar un motivo para revertir a No facturado';
    end if;
    if not public.has_permission('tipo_servicio.revert') then
      raise exception 'Solo un Administrador puede revertir un registro a No facturado';
    end if;
  end if;

  update public.service_type_records
  set status = p_status,
      reverted_reason = case when p_status = 'no_facturado' then p_reverted_reason else reverted_reason end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cambio masivo de tipo de carga (solo aplica a registros no facturados).
create or replace function public.service_type_records_bulk_set_load_type(
  p_ids uuid[],
  p_load_type_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.service_type_records
  set load_type_id = p_load_type_id
  where id = any(p_ids)
    and deleted_at is null
    and status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Eliminacion logica masiva. Igual que la eliminacion individual, un
-- registro Facturado no se puede eliminar (solo los que sigan "no_facturado").
create or replace function public.service_type_records_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.service_type_records
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
