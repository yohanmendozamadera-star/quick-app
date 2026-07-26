-- =========================================================
-- Operación: agrega la columna "Adicionales" al resumen. additional_services
-- no tiene client_id (se relaciona por drogueria/cedi, no por cliente), asi
-- que su conteo no se filtra por p_client_id, solo por rango de fechas.
--
-- El return type cambia (columna nueva), y Postgres no permite modificar
-- el return type de una funcion TABLE con CREATE OR REPLACE, hay que
-- eliminarla primero.
-- =========================================================
drop function if exists public.operacion_resumen(date, date, uuid);

create function public.operacion_resumen(
  p_date_from date,
  p_date_to date,
  p_client_id uuid default null
)
returns table (
  city_id uuid,
  recoleccion_count bigint,
  no_conciliados_count bigint,
  tipo_servicio_count bigint,
  disponibilidad_count bigint,
  adicionales_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with tipo_servicio_load_types as (
    select id from public.load_types where lower(name) in ('neveras', 'periferia', 'volumen')
  ),
  recoleccion as (
    select c.city_id, count(*) as cnt from public.collections c
    where c.deleted_at is null and c.service_date between p_date_from and p_date_to
      and (p_client_id is null or c.client_id = p_client_id)
    group by c.city_id
  ),
  no_conciliados as (
    select c.city_id, count(*) as cnt from public.collections c
    where c.deleted_at is null and c.service_date between p_date_from and p_date_to
      and c.reconciliation_status = 'no_conciliado'
      and (p_client_id is null or c.client_id = p_client_id)
    group by c.city_id
  ),
  tipo_servicio as (
    select r.city_id, count(*) as cnt from public.reconciliations r
    where r.deleted_at is null and r.service_date between p_date_from and p_date_to
      and r.load_type_id in (select id from tipo_servicio_load_types)
      and (p_client_id is null or r.client_id = p_client_id)
    group by r.city_id
  ),
  disponibilidad as (
    select a.city_id, count(*) as cnt from public.availabilities a
    where a.deleted_at is null and a.date between p_date_from and p_date_to
      and (p_client_id is null or a.client_id = p_client_id)
    group by a.city_id
  ),
  adicionales as (
    select cd.city_id, count(*) as cnt from public.additional_services ads
    join public.cedis cd on cd.id = ads.cedi_id
    where ads.deleted_at is null and ads.service_date between p_date_from and p_date_to
    group by cd.city_id
  ),
  all_cities as (
    select city_id from recoleccion union select city_id from no_conciliados
    union select city_id from tipo_servicio union select city_id from disponibilidad
    union select city_id from adicionales
  )
  select ac.city_id, coalesce(r.cnt,0), coalesce(nc.cnt,0), coalesce(ts.cnt,0), coalesce(d.cnt,0), coalesce(ad.cnt,0)
  from all_cities ac
  left join recoleccion r on r.city_id = ac.city_id
  left join no_conciliados nc on nc.city_id = ac.city_id
  left join tipo_servicio ts on ts.city_id = ac.city_id
  left join disponibilidad d on d.city_id = ac.city_id
  left join adicionales ad on ad.city_id = ac.city_id
  where ac.city_id is not null;
$$;
