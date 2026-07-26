-- =========================================================
-- Disponibilidades: se agrega Ciudad (necesaria para la nueva vista
-- "Operacion", que resume Recoleccion/No conciliados/Tipo de Servicio/
-- Disponibilidad por ciudad). Nullable a nivel de base de datos (no romper
-- filas existentes); la app la exige al crear/editar desde ahora.
-- =========================================================
alter table public.availabilities add column if not exists city_id uuid references public.cities(id);
create index if not exists idx_availabilities_city on public.availabilities (city_id);

-- Disponibilidades ahora tiene ciudad: aplica la misma restriccion que ya
-- usan Recoleccion/Conciliacion/Adicionales.
drop policy if exists "availabilities_select" on public.availabilities;
create policy "availabilities_select" on public.availabilities
  for select using (
    public.has_permission('disponibilidades.view')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "availabilities_insert" on public.availabilities;
create policy "availabilities_insert" on public.availabilities
  for insert
  with check (
    public.has_permission('disponibilidades.create')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "availabilities_update" on public.availabilities;
create policy "availabilities_update" on public.availabilities
  for update
  using (
    public.has_permission('disponibilidades.edit')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    public.has_permission('disponibilidades.edit')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

-- Los totales, la seleccion "todos los filtrados" y el duplicado tambien
-- deben reconocer Ciudad ahora.
drop function if exists public.availabilities_totals(text, date, date, uuid, uuid, text);
create or replace function public.availabilities_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_service_type_id uuid default null,
  p_status text default null,
  p_city_id uuid default null
)
returns table (total_count bigint, total_payment numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(payment), 0)::numeric
  from public.availabilities a
  where a.deleted_at is null
    and (p_client_id is null or a.client_id = p_client_id)
    and (p_service_type_id is null or a.service_type_id = p_service_type_id)
    and (p_status is null or a.status = p_status)
    and (p_city_id is null or a.city_id = p_city_id)
    and (p_date_from is null or a.date >= p_date_from)
    and (p_date_to is null or a.date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      a.quicker_name ilike '%' || p_search || '%' or
      a.cedula ilike '%' || p_search || '%' or
      a.order_number ilike '%' || p_search || '%'
    );
$$;

drop function if exists public.availabilities_matching_ids(text, date, date, uuid, uuid, text);
create or replace function public.availabilities_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_service_type_id uuid default null,
  p_status text default null,
  p_city_id uuid default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select a.id
  from public.availabilities a
  where a.deleted_at is null
    and (p_client_id is null or a.client_id = p_client_id)
    and (p_service_type_id is null or a.service_type_id = p_service_type_id)
    and (p_status is null or a.status = p_status)
    and (p_city_id is null or a.city_id = p_city_id)
    and (p_date_from is null or a.date >= p_date_from)
    and (p_date_to is null or a.date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      a.quicker_name ilike '%' || p_search || '%' or
      a.cedula ilike '%' || p_search || '%' or
      a.order_number ilike '%' || p_search || '%'
    );
$$;

create or replace function public.availabilities_duplicate(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_id uuid;
  v_new_order_number text;
begin
  v_new_order_number := public.generate_availability_order_number(current_date);

  insert into public.availabilities (
    client_id, service_type_id, city_id, quicker_name, cedula, date, payment, concept,
    order_number, observation, status
  )
  select
    client_id, service_type_id, city_id, quicker_name, cedula, current_date, payment, concept,
    v_new_order_number, observation, 'registrado'
  from public.availabilities
  where id = p_id and deleted_at is null
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'Registro no encontrado';
  end if;

  return v_new_id;
end;
$$;

-- =========================================================
-- Vista "Operacion": resumen por ciudad de Recoleccion, No conciliados,
-- Tipo de Servicio y Disponibilidad para un rango de fechas (y cliente
-- opcional). security invoker: respeta la restriccion de ciudad de cada
-- tabla automaticamente (un Coordinador solo ve sus ciudades).
-- =========================================================
create or replace function public.operacion_resumen(
  p_date_from date,
  p_date_to date,
  p_client_id uuid default null
)
returns table (
  city_id uuid,
  recoleccion_count bigint,
  no_conciliados_count bigint,
  tipo_servicio_count bigint,
  disponibilidad_count bigint
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
    select c.city_id, count(*) as cnt
    from public.collections c
    where c.deleted_at is null
      and c.service_date between p_date_from and p_date_to
      and (p_client_id is null or c.client_id = p_client_id)
    group by c.city_id
  ),
  no_conciliados as (
    select c.city_id, count(*) as cnt
    from public.collections c
    where c.deleted_at is null
      and c.service_date between p_date_from and p_date_to
      and c.reconciliation_status = 'no_conciliado'
      and (p_client_id is null or c.client_id = p_client_id)
    group by c.city_id
  ),
  tipo_servicio as (
    select r.city_id, count(*) as cnt
    from public.reconciliations r
    where r.deleted_at is null
      and r.service_date between p_date_from and p_date_to
      and r.load_type_id in (select id from tipo_servicio_load_types)
      and (p_client_id is null or r.client_id = p_client_id)
    group by r.city_id
  ),
  disponibilidad as (
    select a.city_id, count(*) as cnt
    from public.availabilities a
    where a.deleted_at is null
      and a.date between p_date_from and p_date_to
      and (p_client_id is null or a.client_id = p_client_id)
    group by a.city_id
  ),
  all_cities as (
    select city_id from recoleccion
    union
    select city_id from no_conciliados
    union
    select city_id from tipo_servicio
    union
    select city_id from disponibilidad
  )
  select
    ac.city_id,
    coalesce(r.cnt, 0) as recoleccion_count,
    coalesce(nc.cnt, 0) as no_conciliados_count,
    coalesce(ts.cnt, 0) as tipo_servicio_count,
    coalesce(d.cnt, 0) as disponibilidad_count
  from all_cities ac
  left join recoleccion r on r.city_id = ac.city_id
  left join no_conciliados nc on nc.city_id = ac.city_id
  left join tipo_servicio ts on ts.city_id = ac.city_id
  left join disponibilidad d on d.city_id = ac.city_id
  where ac.city_id is not null;
$$;
