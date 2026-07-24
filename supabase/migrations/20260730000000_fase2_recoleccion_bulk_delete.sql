-- =========================================================
-- Recoleccion: "seleccionar todos los filtrados" para la eliminacion masiva
-- (mismos filtros que collections_totals, pero devuelve los ids en vez de
-- los totales, igual que el patron ya usado en Tipo de Servicio).
-- =========================================================
create or replace function public.collections_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null,
  p_ids uuid[] default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.collections c
  where c.deleted_at is null
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_reconciliation_status is null or c.reconciliation_status = p_reconciliation_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_ids is null or c.id = any(p_ids))
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_name ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;
