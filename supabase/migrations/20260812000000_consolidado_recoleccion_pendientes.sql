-- =========================================================
-- Consolidado: cambia las metricas mostradas. Antes era
-- Total conciliado / Sin novedad / Con novedad / Reprogramados; ahora es
-- Total recolectado / Total conciliado / Reprogramadas / Total pendientes,
-- para poder comparar cuanto se recogio contra cuanto ya se concilio.
--
-- "Total recolectado" = todas las recolecciones (collections) de esa
-- fecha/ciudad/cedi, sin importar su estado.
-- "Total pendientes" = las que siguen 'no_conciliado' (incluye tanto las
-- recien pendientes como las reprogramadas).
-- "Reprogramadas" = subconjunto de pendientes con mas de 1 dia sin
-- conciliar (current_date - service_date >= 2), igual que antes.
-- El grupo de filas ahora sale de la union de reconciliations (por
-- reconciliation_date) y collections (por service_date), para que un
-- cedi con recolecciones pero cero conciliaciones todavia aparezca.
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
  reprogramada_count bigint,
  reprogramada_amount numeric,
  pendiente_count bigint,
  pendiente_amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with conciliado as (
    select
      r.reconciliation_date as fecha, r.city_id, r.cedi_code, r.cedi_name,
      count(*) as cnt, coalesce(sum(r.collection_amount), 0) as amt
    from public.reconciliations r
    where r.deleted_at is null
      and r.client_id = p_client_id
      and r.cedi_code is not null
      and r.reconciliation_date between p_date_from and p_date_to
      and (p_city_id is null or r.city_id = p_city_id)
    group by r.reconciliation_date, r.city_id, r.cedi_code, r.cedi_name
  ),
  recoleccion as (
    select
      c.service_date as fecha, c.city_id, c.cedi_code, max(c.cedi_name) as cedi_name,
      count(*) as cnt, coalesce(sum(c.collection_amount), 0) as amt
    from public.collections c
    where c.deleted_at is null
      and c.client_id = p_client_id
      and c.cedi_code is not null
      and c.service_date between p_date_from and p_date_to
      and (p_city_id is null or c.city_id = p_city_id)
    group by c.service_date, c.city_id, c.cedi_code
  ),
  pendiente as (
    select
      c.service_date as fecha, c.city_id, c.cedi_code,
      count(*) as cnt, coalesce(sum(c.collection_amount), 0) as amt
    from public.collections c
    where c.deleted_at is null
      and c.client_id = p_client_id
      and c.cedi_code is not null
      and c.reconciliation_status = 'no_conciliado'
      and c.service_date between p_date_from and p_date_to
      and (p_city_id is null or c.city_id = p_city_id)
    group by c.service_date, c.city_id, c.cedi_code
  ),
  reprogramada as (
    select
      c.service_date as fecha, c.city_id, c.cedi_code,
      count(*) as cnt, coalesce(sum(c.collection_amount), 0) as amt
    from public.collections c
    where c.deleted_at is null
      and c.client_id = p_client_id
      and c.cedi_code is not null
      and c.reconciliation_status = 'no_conciliado'
      and (current_date - c.service_date) >= 2
      and c.service_date between p_date_from and p_date_to
      and (p_city_id is null or c.city_id = p_city_id)
    group by c.service_date, c.city_id, c.cedi_code
  ),
  all_rows as (
    select fecha, city_id, cedi_code from conciliado
    union
    select fecha, city_id, cedi_code from recoleccion
  )
  select
    ar.fecha, ar.city_id, ar.cedi_code,
    coalesce(co.cedi_name, rc.cedi_name) as cedi_name,
    coalesce(rc.cnt, 0), coalesce(rc.amt, 0),
    coalesce(co.cnt, 0), coalesce(co.amt, 0),
    coalesce(rp.cnt, 0), coalesce(rp.amt, 0),
    coalesce(p.cnt, 0), coalesce(p.amt, 0)
  from all_rows ar
  left join conciliado co on co.fecha = ar.fecha and co.city_id = ar.city_id and co.cedi_code = ar.cedi_code
  left join recoleccion rc on rc.fecha = ar.fecha and rc.city_id = ar.city_id and rc.cedi_code = ar.cedi_code
  left join pendiente p on p.fecha = ar.fecha and p.city_id = ar.city_id and p.cedi_code = ar.cedi_code
  left join reprogramada rp on rp.fecha = ar.fecha and rp.city_id = ar.city_id and rp.cedi_code = ar.cedi_code;
$$;
