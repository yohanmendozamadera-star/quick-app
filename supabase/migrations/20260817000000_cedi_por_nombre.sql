-- =========================================================
-- Recolección y Conciliación dejan de depender del catálogo de
-- Droguerías: el CEDI ahora se captura como texto libre (Nombre CEDI),
-- sin código. Todo lo que agrupaba/filtraba por cedi_code pasa a usar
-- cedi_name como llave.
-- =========================================================

-- ---------- Consolidado ----------
drop function if exists public.consolidado_resumen(uuid, date, date, uuid);

create function public.consolidado_resumen(
  p_client_id uuid,
  p_date_from date,
  p_date_to date,
  p_city_id uuid default null
)
returns table (
  reconciliation_date date,
  city_id uuid,
  cedi_name text,
  recoleccion_count bigint,
  recoleccion_amount numeric,
  conciliado_count bigint,
  conciliado_amount numeric,
  pendiente_count bigint,
  pendiente_amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.service_date as reconciliation_date,
    c.city_id,
    c.cedi_name,
    count(*) as recoleccion_count,
    coalesce(sum(c.collection_amount), 0) as recoleccion_amount,
    count(*) filter (where c.reconciliation_status = 'conciliado') as conciliado_count,
    coalesce(sum(c.collection_amount) filter (where c.reconciliation_status = 'conciliado'), 0) as conciliado_amount,
    count(*) filter (where c.reconciliation_status = 'no_conciliado') as pendiente_count,
    coalesce(sum(c.collection_amount) filter (where c.reconciliation_status = 'no_conciliado'), 0) as pendiente_amount
  from public.collections c
  where c.deleted_at is null
    and c.client_id = p_client_id
    and c.cedi_name is not null
    and c.service_date between p_date_from and p_date_to
    and (p_city_id is null or c.city_id = p_city_id)
  group by c.service_date, c.city_id, c.cedi_name;
$$;

-- ---------- Paz y Salvos ----------
drop function if exists public.paz_salvo_resumen(uuid, date, date, uuid);

create function public.paz_salvo_resumen(
  p_client_id uuid,
  p_month_from date,
  p_month_to date,
  p_city_id uuid default null
)
returns table (
  period date,
  city_id uuid,
  cedi_name text,
  total_count bigint,
  pending_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', c.service_date)::date as period,
    c.city_id,
    c.cedi_name,
    count(*) as total_count,
    count(*) filter (where c.reconciliation_status = 'no_conciliado') as pending_count
  from public.collections c
  where c.deleted_at is null
    and c.client_id = p_client_id
    and c.cedi_name is not null
    and date_trunc('month', c.service_date)::date between p_month_from and p_month_to
    and (p_city_id is null or c.city_id = p_city_id)
  group by date_trunc('month', c.service_date)::date, c.city_id, c.cedi_name;
$$;

-- ---------- Filtro "Nodo" de Conciliación ----------
-- Renombrar p_cedi_code -> p_cedi_name no lo permite CREATE OR REPLACE
-- (cambia el nombre de un parámetro existente), así que hay que borrar antes.
drop function if exists public.reconciliations_totals(text, date, date, date, date, uuid, uuid, text, text);
drop function if exists public.reconciliations_matching_ids(text, date, date, date, date, uuid, uuid, text, text);

create function public.reconciliations_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null,
  p_cedi_name text default null
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
    and (p_cedi_name is null or r.cedi_name = p_cedi_name)
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

create function public.reconciliations_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null,
  p_cedi_name text default null
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
    and (p_cedi_name is null or r.cedi_name = p_cedi_name)
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

-- Nombres de CEDI distintos que aparecen realmente en los datos del
-- cliente/ciudad filtrados, para poblar el selector "Nodo" ahora que ya
-- no existe un catálogo de Droguerías del que leer las opciones.
create or replace function public.reconciliations_distinct_cedi_names(
  p_client_id uuid default null,
  p_city_id uuid default null
)
returns setof text
language sql
stable
security invoker
set search_path = public
as $$
  select distinct r.cedi_name
  from public.reconciliations r
  where r.deleted_at is null
    and r.cedi_name is not null
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
  order by r.cedi_name;
$$;

-- ---------- Documentos de Paz y Salvo ----------
-- El código ya no se captura: la identidad del CEDI pasa a ser su nombre.
drop index if exists public.uq_paz_salvo_documents_period;
alter table public.paz_salvo_documents alter column cedi_code drop not null;
create unique index uq_paz_salvo_documents_period
  on public.paz_salvo_documents (client_id, cedi_name, period) where deleted_at is null;
