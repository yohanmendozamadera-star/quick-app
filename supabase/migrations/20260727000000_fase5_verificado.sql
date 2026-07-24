-- =========================================================
-- Fase 5 - Renombrar "Facturado / No facturado" a
-- "Verificado / No verificado" en Tipo de Servicio.
-- =========================================================

-- 1) Se quita el CHECK viejo antes de tocar los datos.
alter table public.reconciliations drop constraint if exists reconciliations_billing_status_check;

-- 2) Se migran los valores existentes al nuevo vocabulario.
update public.reconciliations
set billing_status = case billing_status
  when 'facturado' then 'verificado'
  when 'no_facturado' then 'no_verificado'
  else billing_status
end;

-- 3) Nuevo CHECK y nuevo valor por defecto.
alter table public.reconciliations alter column billing_status set default 'no_verificado';
alter table public.reconciliations add constraint reconciliations_billing_status_check
  check (billing_status in ('verificado', 'no_verificado'));

-- La funcion de cambio de estado usa el nuevo vocabulario.
create or replace function public.service_type_bulk_set_billing_status(
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
begin
  if p_status not in ('verificado', 'no_verificado') then
    raise exception 'Estado invalido: %', p_status;
  end if;

  if p_status = 'no_verificado' then
    if p_reverted_reason is null or trim(p_reverted_reason) = '' then
      raise exception 'Debes indicar un motivo para revertir a No verificado';
    end if;
    if not public.has_permission('tipo_servicio.revert') then
      raise exception 'Solo un Administrador puede revertir un registro a No verificado';
    end if;
  end if;

  update public.reconciliations
  set billing_status = p_status,
      billing_reverted_reason = case when p_status = 'no_verificado' then p_reverted_reason else billing_reverted_reason end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- service_type_bulk_delete y service_type_bulk_set_load_type ya filtraban
-- por billing_status = 'no_facturado'; se actualizan al nuevo valor.
create or replace function public.service_type_bulk_set_load_type(
  p_ids uuid[],
  p_load_type_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.reconciliations
  set load_type_id = p_load_type_id
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_verificado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.service_type_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
  rid uuid;
begin
  foreach rid in array p_ids loop
    perform public.unreconcile_collection(rid);
  end loop;

  update public.reconciliations
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_verificado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

update public.permissions
set description = 'Revertir un registro de Verificado a No verificado'
where code = 'tipo_servicio.revert';
