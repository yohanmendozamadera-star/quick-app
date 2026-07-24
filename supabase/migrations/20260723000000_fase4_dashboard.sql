-- =========================================================
-- Fase 4 - Dashboard (Operacion)
-- =========================================================

-- Combina, por fecha + cliente + ciudad, el conteo automatico de
-- Recoleccion con los ajustes manuales del Dashboard. Se agrupa en la base
-- de datos (no se traen registros individuales) para que funcione bien con
-- miles de recolecciones.
create or replace function public.dashboard_operacion_detail(
  p_date_from date,
  p_date_to date
)
returns table (
  operation_date date,
  client_id uuid,
  city_id uuid,
  automatic_count bigint,
  manual_quantity bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(c.service_date, a.adjustment_date) as operation_date,
    coalesce(c.client_id, a.client_id) as client_id,
    coalesce(c.city_id, a.city_id) as city_id,
    coalesce(c.automatic_count, 0) as automatic_count,
    coalesce(a.manual_quantity, 0) as manual_quantity
  from (
    select service_date, client_id, city_id, count(*) as automatic_count
    from public.collections
    where deleted_at is null
      and service_date between p_date_from and p_date_to
    group by service_date, client_id, city_id
  ) c
  full outer join (
    select adjustment_date, client_id, city_id, sum(quantity) as manual_quantity
    from public.collection_manual_adjustments
    where deleted_at is null
      and adjustment_date between p_date_from and p_date_to
    group by adjustment_date, client_id, city_id
  ) a
    on c.service_date = a.adjustment_date
   and c.client_id = a.client_id
   and c.city_id = a.city_id;
$$;
