-- =========================================================
-- Fase 3 - Conciliacion
-- =========================================================

-- Igual que en Recoleccion: "Nombre del cliente" es el nombre de la persona
-- en el servicio, no el cliente corporativo (que sigue siendo client_id).
alter table public.reconciliations add column if not exists client_name text;

-- La insercion (alta manual o carga masiva) debe aceptar tanto a quien puede
-- crear como a quien puede importar.
drop policy if exists "reconciliations_insert" on public.reconciliations;
create policy "reconciliations_insert" on public.reconciliations
  for insert
  with check (public.has_permission('conciliacion.create') or public.has_permission('conciliacion.import'));

-- La eliminacion es logica (UPDATE de deleted_at/deleted_by, no DELETE real).
drop policy if exists "reconciliations_update" on public.reconciliations;
create policy "reconciliations_update" on public.reconciliations
  for update
  using (public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete'))
  with check (public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete'));

-- Totales (cantidad de registros + suma de recaudo) del conjunto filtrado
-- completo, igual que collections_totals.
create or replace function public.reconciliations_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.reconciliations r
  where r.deleted_at is null
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_match_status is null or r.match_status = p_match_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_reconciliation_date_from is null or r.reconciliation_date >= p_reconciliation_date_from)
    and (p_reconciliation_date_to is null or r.reconciliation_date <= p_reconciliation_date_to)
    and (
      p_search is null or p_search = '' or
      r.service_number ilike '%' || p_search || '%' or
      r.client_name ilike '%' || p_search || '%' or
      r.client_document ilike '%' || p_search || '%' or
      r.cedi_name ilike '%' || p_search || '%'
    );
$$;

-- Revierte el cruce: se usa al editar o eliminar una conciliacion, para que
-- la recoleccion enlazada no quede "Conciliado" apuntando a un registro que
-- ya cambio o fue eliminado.
create or replace function public.unreconcile_collection(p_reconciliation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.collections
  set reconciliation_status = 'no_conciliado',
      reconciliation_id = null,
      reconciled_at = null
  where reconciliation_id = p_reconciliation_id;
end;
$$;

-- Ejecuta el cruce automatico (reconcile_collection) para varias
-- conciliaciones en una sola llamada, para no ir y volver del servidor una
-- vez por cada fila de una carga masiva.
create or replace function public.reconcile_collections_batch(p_reconciliation_ids uuid[])
returns table (reconciliation_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  foreach rid in array p_reconciliation_ids loop
    reconciliation_id := rid;
    status := public.reconcile_collection(rid);
    return next;
  end loop;
end;
$$;
