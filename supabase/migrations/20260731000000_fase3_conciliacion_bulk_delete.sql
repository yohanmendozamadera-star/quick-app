-- =========================================================
-- Conciliacion: seleccion masiva y eliminacion masiva (mismo patron que se
-- agrego en Recoleccion). "Seleccionar todos los filtrados" usa los mismos
-- filtros que reconciliations_totals, pero devuelve los ids.
-- =========================================================
create or replace function public.reconciliations_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select r.id
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

-- Deshace el cruce con Recoleccion (igual que al eliminar una por una) antes
-- de la eliminacion logica masiva.
create or replace function public.reconciliations_bulk_delete(p_ids uuid[])
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
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
