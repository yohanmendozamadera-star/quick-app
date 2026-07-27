-- =========================================================
-- Simplifica Consolidado: se quita el concepto de "reprogramadas" (el
-- umbral de "mas de 1 dia sin conciliar" complicaba la lectura sin
-- aportar valor). Ahora son solo 3 numeros: recolectado, conciliado, y
-- pendiente (= recolectado - conciliado).
-- =========================================================
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
  cedi_code text,
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
    c.cedi_code,
    max(c.cedi_name) as cedi_name,
    count(*) as recoleccion_count,
    coalesce(sum(c.collection_amount), 0) as recoleccion_amount,
    count(*) filter (where c.reconciliation_status = 'conciliado') as conciliado_count,
    coalesce(sum(c.collection_amount) filter (where c.reconciliation_status = 'conciliado'), 0) as conciliado_amount,
    count(*) filter (where c.reconciliation_status = 'no_conciliado') as pendiente_count,
    coalesce(sum(c.collection_amount) filter (where c.reconciliation_status = 'no_conciliado'), 0) as pendiente_amount
  from public.collections c
  where c.deleted_at is null
    and c.client_id = p_client_id
    and c.cedi_code is not null
    and c.service_date between p_date_from and p_date_to
    and (p_city_id is null or c.city_id = p_city_id)
  group by c.service_date, c.city_id, c.cedi_code;
$$;
