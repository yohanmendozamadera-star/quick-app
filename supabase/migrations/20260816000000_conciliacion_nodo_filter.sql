-- =========================================================
-- Conciliación: filtro por Nodo (CEDI), agregado como parámetro adicional
-- con default null — no cambia el tipo de retorno, así que CREATE OR REPLACE
-- basta (sin necesidad de drop).
-- =========================================================
create or replace function public.reconciliations_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null,
  p_cedi_code text default null
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
    and (p_cedi_code is null or r.cedi_code = p_cedi_code)
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

create or replace function public.reconciliations_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null,
  p_cedi_code text default null
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
    and (p_cedi_code is null or r.cedi_code = p_cedi_code)
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
