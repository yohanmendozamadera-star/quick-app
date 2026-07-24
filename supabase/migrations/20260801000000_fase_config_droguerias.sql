-- =========================================================
-- Configuraciones - Droguerias (CEDI)
-- El codigo de drogueria (ej. D828) pasa a ser unico globalmente (antes era
-- unico solo por cliente), porque el mismo codigo siempre identifica la
-- misma drogueria/ciudad sin importar el cliente. Tambien se agrega la
-- relacion en Adicionales, que hasta ahora no tenia campo de drogueria.
-- =========================================================

-- Indice simple (no funcional) para que la carga masiva pueda hacer upsert
-- por codigo (ON CONFLICT necesita una constraint/indice sobre la columna
-- tal cual). La app normaliza el codigo a mayusculas antes de guardar.
drop index if exists uq_cedis_code;
alter table public.cedis add constraint uq_cedis_code_global unique (code);

alter table public.additional_services
  add column if not exists cedi_id uuid references public.cedis(id);
create index if not exists idx_additional_services_cedi on public.additional_services (cedi_id);

-- additional_services_duplicate debe copiar tambien la drogueria (cedi_id).
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
    coordinator_id, cenlog_id, cedi_id, service_type_id, resources_count_range,
    resource_group_id, resource_name, resource_document, plate, service_date,
    transport_type_id, charge_description_id, start_time, end_time,
    services_count, delivery_support_note, client_authorization_note, status
  )
  select
    coordinator_id, cenlog_id, cedi_id, service_type_id, resources_count_range,
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
