-- =========================================================
-- Fase 7 - Disponibilidades
-- Simplifica la tabla al formulario real que se pidio: sin Coordinador de
-- catalogo (el "Coordinador" que se ve en pantalla es quien registra, ya
-- guardado en created_by), sin placa/cantidad de servicios/horarios/clave.
-- Se agrega "Concepto" y el numero de orden se genera con fecha + codigo
-- alfanumerico aleatorio (no necesita clave).
-- =========================================================

-- ---------- Tipo de servicio (Disponibilidades): Dia, Media Dia, Recoleccion ----------
do $$
declare
  v_conname text;
begin
  select con.conname into v_conname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'service_types' and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%scope%';
  if v_conname is not null then
    execute format('alter table public.service_types drop constraint %I', v_conname);
  end if;
end;
$$;

alter table public.service_types
  add constraint service_types_scope_check check (scope in ('recoleccion', 'adicionales', 'disponibilidades'));

insert into public.service_types (scope, name) values
  ('disponibilidades', 'Día'),
  ('disponibilidades', 'Media Día'),
  ('disponibilidades', 'Recolección')
on conflict do nothing;

-- ---------- Simplificacion de availabilities ----------
alter table public.availabilities drop constraint if exists chk_availabilities_time_range;
drop index if exists idx_availabilities_coordinator;

alter table public.availabilities drop column if exists coordinator_id;
alter table public.availabilities drop column if exists plate;
alter table public.availabilities drop column if exists services_count;
alter table public.availabilities drop column if exists start_time;
alter table public.availabilities drop column if exists end_time;
alter table public.availabilities drop column if exists key_id;

alter table public.availabilities add column if not exists concept text;

alter table public.availabilities alter column service_type_id set not null;

update public.availabilities set status = 'registrado' where status not in ('registrado', 'aprobado', 'autorizado');
alter table public.availabilities alter column status set default 'registrado';
alter table public.availabilities drop constraint if exists chk_availabilities_status;
alter table public.availabilities add constraint chk_availabilities_status
  check (status in ('registrado', 'aprobado', 'autorizado'));

-- ---------- Permiso de aprobacion (perfiles Lider) ----------
insert into public.permissions (code, module, description) values
  ('disponibilidades.approve', 'disponibilidades', 'Aprobar o autorizar un registro de disponibilidad')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador' and p.code = 'disponibilidades.approve'
on conflict do nothing;

-- ---------- Numero de orden: fecha (DDMMAAAA) + codigo alfanumerico de 7 ----------
create or replace function public.generate_availability_order_number(p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_date_part text := to_char(p_date, 'DDMMYYYY');
  v_code text;
  v_order_number text;
  v_attempt integer := 0;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..7 loop
      v_code := v_code || substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1);
    end loop;
    v_order_number := v_date_part || v_code;
    exit when not exists (select 1 from public.availabilities where order_number = v_order_number);
    v_attempt := v_attempt + 1;
    if v_attempt > 20 then
      raise exception 'No se pudo generar un número de orden único';
    end if;
  end loop;
  return v_order_number;
end;
$$;

-- ---------- Totales / seleccion masiva / duplicado / estado ----------
create or replace function public.availabilities_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_service_type_id uuid default null,
  p_status text default null
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
    and (p_date_from is null or a.date >= p_date_from)
    and (p_date_to is null or a.date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      a.quicker_name ilike '%' || p_search || '%' or
      a.cedula ilike '%' || p_search || '%' or
      a.order_number ilike '%' || p_search || '%'
    );
$$;

create or replace function public.availabilities_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_service_type_id uuid default null,
  p_status text default null
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
    and (p_date_from is null or a.date >= p_date_from)
    and (p_date_to is null or a.date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      a.quicker_name ilike '%' || p_search || '%' or
      a.cedula ilike '%' || p_search || '%' or
      a.order_number ilike '%' || p_search || '%'
    );
$$;

-- Cambiar a "aprobado"/"autorizado" exige el permiso disponibilidades.approve
-- (pensado para los perfiles Lider). Volver a "registrado" tambien lo exige,
-- por ser igualmente una reversion de un estado ya aprobado.
create or replace function public.availabilities_bulk_set_status(
  p_ids uuid[],
  p_status text
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_status not in ('registrado', 'aprobado', 'autorizado') then
    raise exception 'Estado inválido: %', p_status;
  end if;

  if p_status <> 'registrado' and not public.has_permission('disponibilidades.approve') then
    raise exception 'Solo un Líder puede aprobar o autorizar un registro';
  end if;

  update public.availabilities
  set status = p_status
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Los "autorizado" no se eliminan (registro cerrado).
create or replace function public.availabilities_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.availabilities
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and status <> 'autorizado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Duplicar conserva los datos pero nace en "registrado", con fecha de hoy y
-- un numero de orden nuevo.
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
    client_id, service_type_id, quicker_name, cedula, date, payment, concept,
    order_number, observation, status
  )
  select
    client_id, service_type_id, quicker_name, cedula, current_date, payment, concept,
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
