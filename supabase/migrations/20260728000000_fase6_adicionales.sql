-- =========================================================
-- Fase 6 - Adicionales
-- La tabla, catalogos, permisos base (view/create/edit/delete/import/export)
-- y politicas RLS ya existian desde la Fase 1. Aqui se agrega lo que falta:
-- permiso de reversion (igual que Tipo de Servicio), funciones de totales /
-- seleccion masiva / cambio de estado / eliminacion / duplicado, y el bucket
-- de almacenamiento para los adjuntos (soporte de entregas y autorizacion).
-- =========================================================

-- ---------- Permiso de reversion (solo Administrador) ----------
insert into public.permissions (code, module, description) values
  ('adicionales.revert', 'adicionales', 'Revertir un registro de Facturado a otro estado')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador' and p.code = 'adicionales.revert'
on conflict do nothing;

-- ---------- Totales dinamicos segun filtros activos ----------
-- Busca por nombre/cedula/placa del recurso (el "buscador general" de la
-- vista, igual que el numero de servicio en Recoleccion/Conciliacion).
create or replace function public.additional_services_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_coordinator_id uuid default null,
  p_cenlog_id uuid default null,
  p_service_type_id uuid default null,
  p_charge_description_id uuid default null,
  p_status text default null
)
returns table (total_count bigint, total_services bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(services_count), 0)::bigint
  from public.additional_services a
  where a.deleted_at is null
    and (p_coordinator_id is null or a.coordinator_id = p_coordinator_id)
    and (p_cenlog_id is null or a.cenlog_id = p_cenlog_id)
    and (p_service_type_id is null or a.service_type_id = p_service_type_id)
    and (p_charge_description_id is null or a.charge_description_id = p_charge_description_id)
    and (p_status is null or a.status = p_status)
    and (p_date_from is null or a.service_date >= p_date_from)
    and (p_date_to is null or a.service_date <= p_date_to)
    and (
      p_search is null or p_search = ''
      or a.resource_name ilike '%' || p_search || '%'
      or a.resource_document ilike '%' || p_search || '%'
      or a.plate ilike '%' || p_search || '%'
    );
$$;

create or replace function public.additional_services_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_coordinator_id uuid default null,
  p_cenlog_id uuid default null,
  p_service_type_id uuid default null,
  p_charge_description_id uuid default null,
  p_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.additional_services a
  where a.deleted_at is null
    and (p_coordinator_id is null or a.coordinator_id = p_coordinator_id)
    and (p_cenlog_id is null or a.cenlog_id = p_cenlog_id)
    and (p_service_type_id is null or a.service_type_id = p_service_type_id)
    and (p_charge_description_id is null or a.charge_description_id = p_charge_description_id)
    and (p_status is null or a.status = p_status)
    and (p_date_from is null or a.service_date >= p_date_from)
    and (p_date_to is null or a.service_date <= p_date_to)
    and (
      p_search is null or p_search = ''
      or a.resource_name ilike '%' || p_search || '%'
      or a.resource_document ilike '%' || p_search || '%'
      or a.plate ilike '%' || p_search || '%'
    );
$$;

-- ---------- Cambio de estado (individual o masivo) ----------
-- Salir de "facturado" hacia cualquier otro estado exige motivo y el permiso
-- adicionales.revert (Administrador). El resto de transiciones solo exige
-- adicionales.edit, que ya valida la politica RLS de UPDATE.
create or replace function public.additional_services_bulk_set_status(
  p_ids uuid[],
  p_status text,
  p_reverted_reason text default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  v_needs_revert boolean;
begin
  if p_status not in ('pendiente', 'reportado', 'aprobado', 'rechazado', 'facturado') then
    raise exception 'Estado invalido: %', p_status;
  end if;

  select exists (
    select 1 from public.additional_services
    where id = any(p_ids) and deleted_at is null and status = 'facturado'
  ) into v_needs_revert;

  if v_needs_revert and p_status <> 'facturado' then
    if p_reverted_reason is null or trim(p_reverted_reason) = '' then
      raise exception 'Debes indicar un motivo para revertir un registro Facturado';
    end if;
    if not public.has_permission('adicionales.revert') then
      raise exception 'Solo un Administrador puede revertir un registro Facturado';
    end if;
  end if;

  update public.additional_services
  set status = p_status,
      reverted_reason = case
        when v_needs_revert and p_status <> 'facturado' then p_reverted_reason
        else reverted_reason
      end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- Eliminacion logica masiva (los Facturados no se eliminan) ----------
create or replace function public.additional_services_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.additional_services
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and status <> 'facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- Duplicar registro ----------
-- Crea una fila nueva con los mismos datos, en estado "Pendiente" (una
-- solicitud duplicada empieza su propio flujo de aprobacion desde cero, sin
-- heredar el estado de la original). No agrupa con el original ni copia sus
-- adjuntos: son evidencia especifica de la solicitud original.
create or replace function public.additional_services_duplicate(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  insert into public.additional_services (
    coordinator_id, cenlog_id, service_type_id, resources_count_range,
    resource_group_id, resource_name, resource_document, plate, service_date,
    transport_type_id, charge_description_id, start_time, end_time,
    services_count, delivery_support_note, client_authorization_note, status
  )
  select
    coordinator_id, cenlog_id, service_type_id, resources_count_range,
    null, resource_name, resource_document, plate, service_date,
    transport_type_id, charge_description_id, start_time, end_time,
    services_count, delivery_support_note, client_authorization_note, 'pendiente'
  from public.additional_services
  where id = p_id and deleted_at is null
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'Registro no encontrado';
  end if;

  return v_new_id;
end;
$$;

-- ---------- Almacenamiento de adjuntos (soporte de entregas / autorizacion) ----------
insert into storage.buckets (id, name, public)
values ('adicionales', 'adicionales', false)
on conflict (id) do nothing;

drop policy if exists "adicionales_files_select" on storage.objects;
create policy "adicionales_files_select" on storage.objects
  for select using (bucket_id = 'adicionales' and public.has_permission('adicionales.view'));

drop policy if exists "adicionales_files_insert" on storage.objects;
create policy "adicionales_files_insert" on storage.objects
  for insert with check (bucket_id = 'adicionales' and public.has_permission('adicionales.edit'));

drop policy if exists "adicionales_files_delete" on storage.objects;
create policy "adicionales_files_delete" on storage.objects
  for delete using (bucket_id = 'adicionales' and public.has_permission('adicionales.edit'));
