-- =========================================================
-- Fase 2 - Carga masiva de Recoleccion
-- =========================================================

-- Nuevos campos que vienen en el texto pegado desde Excel/Sheets:
-- "nombre cliente" (nombre de la persona en el servicio, no el cliente
-- corporativo) y "novedad" (observacion libre).
alter table public.collections add column if not exists client_name text;
alter table public.collections add column if not exists note text;

-- El buscador general de la tabla tambien debe encontrar por "nombre cliente".
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
      c.client_name ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;

-- La carga masiva tambien es una forma de "crear" registros: la politica de
-- insert debe aceptar tanto a quien puede crear manualmente como a quien
-- puede importar.
drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import'));

-- Faltaba la politica de insert para el detalle de errores de importacion.
drop policy if exists "import_errors_insert" on public.import_errors;
create policy "import_errors_insert" on public.import_errors
  for insert
  with check (
    exists (
      select 1 from public.import_batches b
      where b.id = batch_id and b.user_id = auth.uid()
    )
  );
