-- =========================================================
-- Fase 2 - Ajustes: quitar "Tipo de servicio" de Recoleccion,
-- ampliar catalogo de Tipo de carga, filtro multi-seleccion.
-- =========================================================

-- "Tipo de servicio" en Recoleccion quedaba redundante con "Tipo de carga".
alter table public.collections drop column if exists service_type_id;

-- Nuevos valores del catalogo de tipos de carga.
insert into public.load_types (name) values ('Entrega'), ('Carga Seca')
on conflict do nothing;

-- collections_totals: se quita el filtro por tipo de servicio (columna
-- eliminada) y el de tipo de carga pasa a aceptar varios valores a la vez.
drop function if exists public.collections_totals(text, date, date, uuid, uuid, uuid, uuid, text);

create or replace function public.collections_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null
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
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;
