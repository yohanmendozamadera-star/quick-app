-- =========================================================
-- Ajustes: no duplicar guias en Conciliacion, corregir el
-- desfase de columnas de su carga masiva, y filtro de Oportunidad
-- en Recoleccion.
-- =========================================================

-- Al igual que en Recoleccion, una misma guia no puede conciliarse dos veces
-- para el mismo cliente.
create unique index if not exists uq_reconciliations_service_number
  on public.reconciliations (client_id, service_number) where deleted_at is null;

-- Faltaba el campo de tipo de carga (la carga masiva traia esta columna y,
-- al no existir, desplazaba "documento cliente" y "recaudo" una posicion).
alter table public.reconciliations add column if not exists load_type_id uuid references public.load_types(id);

-- IDs de recolecciones que llevan N dias o mas sin conciliar (para el
-- filtro "Oportunidad"). Se compara por fecha calendario en hora de
-- Colombia, igual que en la pantalla.
create or replace function public.collections_opportunity_ids(p_min_days integer)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.collections
  where deleted_at is null
    and reconciliation_status = 'no_conciliado'
    and (
      ((now() at time zone 'America/Bogota')::date)
      - ((created_at at time zone 'America/Bogota')::date)
    ) >= p_min_days;
$$;

-- collections_totals ahora tambien puede acotarse a una lista de ids
-- puntual (usada por el filtro de Oportunidad).
drop function if exists public.collections_totals(text, date, date, uuid, uuid, uuid[], text);

create or replace function public.collections_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null,
  p_ids uuid[] default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
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
