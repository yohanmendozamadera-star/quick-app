-- =========================================================
-- Fase 5 (segunda correccion) - Tipo de Servicio pasa a ser una
-- vista filtrada de CONCILIACION (no de Recoleccion): mismo registro,
-- porque la fecha de servicio real es la que trae la conciliacion.
-- =========================================================

-- Revertir lo que se agrego sobre collections para el intento anterior:
-- Nodo y Operacion no estaban en la lista de campos real, y el estado de
-- facturacion ahora vive en reconciliations.
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select using (public.has_permission('recoleccion.view'));

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import'));

drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
  with check (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'));

drop function if exists public.service_type_view_totals(uuid[], text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_view_matching_ids(uuid[], text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_bulk_set_billing_status(uuid[], text, text);
drop function if exists public.service_type_bulk_set_load_type(uuid[], uuid);
drop function if exists public.service_type_bulk_delete(uuid[]);

alter table public.collections drop column if exists node_id;
alter table public.collections drop column if exists operation;
alter table public.collections drop column if exists billing_status;
alter table public.collections drop column if exists billing_reverted_reason;

-- El estado de facturacion de Tipo de Servicio vive en reconciliations,
-- que es su verdadera fuente.
alter table public.reconciliations add column if not exists billing_status text not null default 'no_facturado'
  check (billing_status in ('facturado', 'no_facturado'));
alter table public.reconciliations add column if not exists billing_reverted_reason text;

-- reconciliations ahora sirve a dos modulos (Conciliacion y Tipo de
-- Servicio): las politicas deben aceptar los permisos de cualquiera.
drop policy if exists "reconciliations_select" on public.reconciliations;
create policy "reconciliations_select" on public.reconciliations
  for select
  using (public.has_permission('conciliacion.view') or public.has_permission('tipo_servicio.view'));

drop policy if exists "reconciliations_insert" on public.reconciliations;
create policy "reconciliations_insert" on public.reconciliations
  for insert
  with check (
    public.has_permission('conciliacion.create') or public.has_permission('conciliacion.import')
    or public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import')
  );

drop policy if exists "reconciliations_update" on public.reconciliations;
create policy "reconciliations_update" on public.reconciliations
  for update
  using (
    public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  )
  with check (
    public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  );

-- Totales (cantidad + suma de recaudo) para la vista de Tipo de Servicio:
-- reconciliations filtrado a los tipos de carga de este modulo (Nevera,
-- Periferia, Volumen), mas los filtros propios de la vista.
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
  from public.reconciliations r
  where r.deleted_at is null
    and r.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_load_type_ids is null or r.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or r.billing_status = p_billing_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_search is null or p_search = '' or r.service_number ilike '%' || p_search || '%');
$$;

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
  from public.reconciliations r
  where r.deleted_at is null
    and r.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_load_type_ids is null or r.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or r.billing_status = p_billing_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_search is null or p_search = '' or r.service_number ilike '%' || p_search || '%');
$$;

-- Cambio de estado de facturacion (individual o masivo). Revertir a
-- "no_facturado" exige motivo y permiso de Administrador.
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

  update public.reconciliations
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
  update public.reconciliations
  set load_type_id = p_load_type_id
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Eliminacion logica masiva (deshace el cruce con Recoleccion antes de
-- eliminar, igual que en Conciliacion). Los Facturados no se eliminan.
create or replace function public.service_type_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  rid uuid;
begin
  foreach rid in array p_ids loop
    perform public.unreconcile_collection(rid);
  end loop;

  update public.reconciliations
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
