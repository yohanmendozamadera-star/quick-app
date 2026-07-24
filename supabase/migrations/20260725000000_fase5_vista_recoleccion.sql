-- =========================================================
-- Fase 5 (correccion) - Tipo de Servicio pasa a ser una vista
-- filtrada de Recoleccion (mismo registro), no una tabla aparte.
-- =========================================================

-- La tabla independiente que se creo antes no llego a usarse con datos
-- reales; se elimina junto con sus funciones especificas.
drop function if exists public.service_type_records_totals(text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_records_matching_ids(text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_records_bulk_set_status(uuid[], text, text);
drop function if exists public.service_type_records_bulk_set_load_type(uuid[], uuid);
drop function if exists public.service_type_records_bulk_delete(uuid[]);
drop table if exists public.service_type_records;

-- Campos propios de Tipo de Servicio, agregados directamente sobre
-- collections: es el mismo registro de Recoleccion, visto con informacion
-- adicional (Nodo, Operacion, si ya fue Facturado).
alter table public.collections add column if not exists node_id uuid references public.nodes(id);
alter table public.collections add column if not exists operation text;
alter table public.collections add column if not exists billing_status text not null default 'no_facturado'
  check (billing_status in ('facturado', 'no_facturado'));
alter table public.collections add column if not exists billing_reverted_reason text;

-- Recoleccion y Tipo de Servicio comparten la misma tabla: las politicas de
-- collections deben aceptar los permisos de cualquiera de los dos modulos.
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select
  using (public.has_permission('recoleccion.view') or public.has_permission('tipo_servicio.view'));

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (
    public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import')
    or public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import')
  );

drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (
    public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  )
  with check (
    public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  );

-- Totales (cantidad + suma de valor) para la vista de Tipo de Servicio:
-- collections filtrado a los tipos de carga que le corresponden a este
-- modulo (Nevera, Periferia, Volumen), mas los filtros propios de la vista.
create or replace function public.service_type_view_totals(
  p_relevant_load_type_ids uuid[],
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_billing_status text default null
)
returns table (total_count bigint, total_value numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.collections c
  where c.deleted_at is null
    and c.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or c.billing_status = p_billing_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_search is null or p_search = '' or c.service_number ilike '%' || p_search || '%');
$$;

-- Ids de todos los registros que cumplen los filtros (para "seleccionar
-- todos los N encontrados").
create or replace function public.service_type_view_matching_ids(
  p_relevant_load_type_ids uuid[],
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_billing_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.collections c
  where c.deleted_at is null
    and c.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or c.billing_status = p_billing_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_search is null or p_search = '' or c.service_number ilike '%' || p_search || '%');
$$;

-- Cambio de estado de facturacion (uno o varios a la vez). Revertir a
-- "no_facturado" exige motivo y el permiso tipo_servicio.revert
-- (Administrador).
create or replace function public.service_type_bulk_set_billing_status(
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

  update public.collections
  set billing_status = p_status,
      billing_reverted_reason = case when p_status = 'no_facturado' then p_reverted_reason else billing_reverted_reason end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cambio masivo de tipo de carga (solo registros no facturados).
create or replace function public.service_type_bulk_set_load_type(
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
  update public.collections
  set load_type_id = p_load_type_id
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Eliminacion logica masiva. Al ser el mismo registro de Recoleccion,
-- eliminarlo aqui tambien lo quita de esa vista. Los Facturados no se
-- pueden eliminar.
create or replace function public.service_type_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.collections
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
