-- =========================================================
-- Funciones y triggers
-- =========================================================

-- ---------- Sello de auditoria (created_by/updated_by/timestamps) ----------
create or replace function public.fn_set_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_at := now();
    new.updated_by := auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ---------- updated_at simple para catalogos ----------
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Bitacora de auditoria generica ----------
create or replace function public.fn_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module text := TG_ARGV[0];
begin
  if TG_OP = 'INSERT' then
    insert into public.audit_logs (user_id, action, module, record_id, old_data, new_data)
    values (auth.uid(), 'create', v_module, new.id, null, to_jsonb(new));
    return new;
  elsif TG_OP = 'UPDATE' then
    insert into public.audit_logs (user_id, action, module, record_id, old_data, new_data)
    values (auth.uid(), 'update', v_module, new.id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif TG_OP = 'DELETE' then
    insert into public.audit_logs (user_id, action, module, record_id, old_data, new_data)
    values (auth.uid(), 'delete', v_module, old.id, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;

-- Aplicar triggers de auditoria a cada tabla principal
do $$
declare
  t record;
begin
  for t in
    select unnest(array[
      'collections', 'collection_manual_adjustments', 'reconciliations',
      'service_type_records', 'additional_services', 'availabilities'
    ]) as table_name
  loop
    execute format(
      'drop trigger if exists trg_%1$s_audit_fields on public.%1$s;
       create trigger trg_%1$s_audit_fields
       before insert or update on public.%1$s
       for each row execute function public.fn_set_audit_fields();',
      t.table_name
    );
    execute format(
      'drop trigger if exists trg_%1$s_audit_log on public.%1$s;
       create trigger trg_%1$s_audit_log
       after insert or update or delete on public.%1$s
       for each row execute function public.fn_audit_trigger(%1$L);',
      t.table_name
    );
  end loop;
end;
$$;

-- updated_at automatico en catalogos y profiles
do $$
declare
  t record;
begin
  for t in
    select unnest(array[
      'roles', 'clients', 'cities', 'cedis', 'service_types', 'load_types',
      'transport_types', 'charge_descriptions', 'statuses', 'coordinators',
      'cenlogs', 'nodes', 'keys', 'profiles'
    ]) as table_name
  loop
    execute format(
      'drop trigger if exists trg_%1$s_touch_updated_at on public.%1$s;
       create trigger trg_%1$s_touch_updated_at
       before update on public.%1$s
       for each row execute function public.fn_touch_updated_at();',
      t.table_name
    );
  end loop;
end;
$$;

-- ---------- Generacion segura de numero de orden (Disponibilidades) ----------
-- Formato: AAAAMMDD-CLAVE-000001. Atomico via INSERT ... ON CONFLICT, por lo
-- que dos usuarios registrando al mismo tiempo nunca reciben el mismo numero.
-- Debe llamarse siempre desde el backend, nunca calcularse en el navegador.
create or replace function public.generate_order_number(p_key_code text, p_date date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_code text := upper(trim(p_key_code));
  v_seq integer;
begin
  if v_key_code is null or v_key_code = '' then
    raise exception 'La clave es obligatoria para generar el numero de orden';
  end if;

  insert into public.daily_order_sequences (seq_date, key_code, last_sequence)
  values (p_date, v_key_code, 1)
  on conflict (seq_date, key_code)
  do update set last_sequence = public.daily_order_sequences.last_sequence + 1
  returning last_sequence into v_seq;

  return to_char(p_date, 'YYYYMMDD') || '-' || v_key_code || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

-- ---------- Cruce automatico Conciliacion -> Recoleccion ----------
-- Se ejecuta al guardar una conciliacion (manual o masiva). Busca la
-- recoleccion por numero de servicio y, si coincide, marca ambas como
-- conciliadas y enlaza el id. Devuelve el estado del cruce.
create or replace function public.reconcile_collection(p_reconciliation_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_collection_id uuid;
begin
  select * into v_rec from public.reconciliations where id = p_reconciliation_id;
  if not found then
    raise exception 'Conciliacion % no encontrada', p_reconciliation_id;
  end if;

  select id into v_collection_id
  from public.collections
  where service_number = v_rec.service_number
    and deleted_at is null
    and (v_rec.client_id is null or client_id = v_rec.client_id)
  order by
    case when client_document is not distinct from v_rec.client_document then 0 else 1 end,
    case when service_date is not distinct from v_rec.service_date then 0 else 1 end
  limit 1;

  if v_collection_id is null then
    update public.reconciliations
    set match_status = 'unmatched'
    where id = p_reconciliation_id;
    return 'unmatched';
  end if;

  update public.collections
  set reconciliation_status = 'conciliado',
      reconciliation_id = p_reconciliation_id,
      reconciled_at = now()
  where id = v_collection_id;

  update public.reconciliations
  set match_status = 'matched',
      matched_collection_id = v_collection_id
  where id = p_reconciliation_id;

  return 'matched';
end;
$$;
