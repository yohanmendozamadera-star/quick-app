-- Extensiones necesarias
create extension if not exists pgcrypto;
-- =========================================================
-- Tablas de catálogo (configuración administrable)
-- Todas quedan disponibles para lectura de cualquier usuario
-- autenticado (se usan en selectores/filtros) y solo se
-- administran (insert/update/delete) con el permiso config.manage.
-- =========================================================

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  description text
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_clients_name on public.clients (lower(name));

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_cities_name on public.cities (lower(name));

create table public.cedis (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id),
  city_id uuid references public.cities(id),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_cedis_code on public.cedis (coalesce(client_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

-- scope distingue el catalogo de "tipo de servicio" de Recoleccion/Conciliacion
-- del catalogo de "tipo de servicio" de Adicionales (son listas de negocio distintas)
create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('recoleccion', 'adicionales')),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_service_types_scope_name on public.service_types (scope, lower(name));

create table public.load_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_load_types_name on public.load_types (lower(name));

create table public.transport_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_transport_types_name on public.transport_types (lower(name));

create table public.charge_descriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_charge_descriptions_name on public.charge_descriptions (lower(name));

-- Catalogo de PRESENTACION de estados (etiqueta/color). Las transiciones de
-- negocio reales se controlan con CHECK constraints en cada tabla principal,
-- no aqui, para que nadie pueda romper el bloqueo de registros facturados
-- inventando un estado nuevo desde este catalogo.
create table public.statuses (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  code text not null,
  label text not null,
  color text not null default 'gray',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_statuses_module_code on public.statuses (module, code);

create table public.coordinators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_coordinators_name on public.coordinators (lower(name));

create table public.cenlogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_cenlogs_name on public.cenlogs (lower(name));

create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_nodes_name on public.nodes (lower(name));

-- "Claves" usadas para generar el numero de orden de Disponibilidades
create table public.keys (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_keys_code on public.keys (upper(code));
-- =========================================================
-- profiles: extiende auth.users con nombre, rol y estado.
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role_id uuid not null references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_profiles_role_id on public.profiles (role_id);

-- Cuando se crea un usuario en auth.users (Supabase Auth), se crea
-- automaticamente su fila en profiles con el rol de menor privilegio
-- (Consulta) como valor seguro por defecto. Un Administrador debe
-- entrar despues a Configuracion > Usuarios y asignarle el rol correcto.
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_role_id uuid;
begin
  select id into v_default_role_id from public.roles where name = 'Consulta';

  insert into public.profiles (id, full_name, email, role_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    v_default_role_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.fn_handle_new_user();
-- =========================================================
-- Tablas principales (transaccionales)
-- Todas incluyen: id, created_at/by, updated_at/by, deleted_at/by, is_active
-- =========================================================

-- ---------- Recoleccion ----------
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  service_number text not null,
  client_id uuid not null references public.clients(id),
  city_id uuid not null references public.cities(id),
  cedi_code text,
  cedi_name text,
  service_address text,
  service_date date not null,
  service_type_id uuid references public.service_types(id),
  load_type_id uuid references public.load_types(id),
  client_document text,
  collection_amount numeric(14, 2) not null default 0,
  reconciliation_status text not null default 'no_conciliado'
    check (reconciliation_status in ('no_conciliado', 'conciliado')),
  reconciliation_id uuid, -- FK agregada mas abajo (referencia circular con reconciliations)
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  is_active boolean not null default true
);
create unique index uq_collections_service_number
  on public.collections (client_id, service_number) where deleted_at is null;
create index idx_collections_service_date on public.collections (service_date);
create index idx_collections_client_id on public.collections (client_id);
create index idx_collections_city_id on public.collections (city_id);
create index idx_collections_reconciliation_status on public.collections (reconciliation_status);
create index idx_collections_load_type_id on public.collections (load_type_id);

create table public.collection_manual_adjustments (
  id uuid primary key default gen_random_uuid(),
  adjustment_date date not null,
  client_id uuid not null references public.clients(id),
  city_id uuid not null references public.cities(id),
  quantity integer not null check (quantity <> 0),
  reason text not null,
  observation text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  is_active boolean not null default true
);
create index idx_adjustments_date on public.collection_manual_adjustments (adjustment_date);
create index idx_adjustments_client_id on public.collection_manual_adjustments (client_id);

-- ---------- Conciliacion ----------
create table public.reconciliations (
  id uuid primary key default gen_random_uuid(),
  service_number text not null,
  client_id uuid references public.clients(id),
  novedad text,
  city_id uuid references public.cities(id),
  cedi_code text,
  cedi_name text,
  service_address text,
  service_date date,
  service_type_id uuid references public.service_types(id),
  client_document text,
  collection_amount numeric(14, 2) not null default 0,
  reconciliation_date date not null default current_date,
  matched_collection_id uuid references public.collections(id),
  match_status text not null default 'unmatched' check (match_status in ('matched', 'unmatched')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  is_active boolean not null default true
);
create index idx_reconciliations_service_number on public.reconciliations (service_number);
create index idx_reconciliations_service_date on public.reconciliations (service_date);
create index idx_reconciliations_reconciliation_date on public.reconciliations (reconciliation_date);
create index idx_reconciliations_client_id on public.reconciliations (client_id);

alter table public.collections
  add constraint fk_collections_reconciliation
  foreign key (reconciliation_id) references public.reconciliations(id);

-- ---------- Tipo de Servicio ----------
create table public.service_type_records (
  id uuid primary key default gen_random_uuid(),
  guide text not null,
  client_id uuid not null references public.clients(id),
  value numeric(14, 2) not null default 0,
  address text,
  node_id uuid references public.nodes(id),
  load_type_id uuid not null references public.load_types(id),
  record_date date not null,
  city_id uuid not null references public.cities(id),
  operation text,
  status text not null default 'no_facturado' check (status in ('facturado', 'no_facturado')),
  reverted_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  is_active boolean not null default true
);
create unique index uq_service_type_records_guide
  on public.service_type_records (client_id, guide) where deleted_at is null;
create index idx_service_type_records_date on public.service_type_records (record_date);
create index idx_service_type_records_city on public.service_type_records (city_id);
create index idx_service_type_records_load_type on public.service_type_records (load_type_id);
create index idx_service_type_records_status on public.service_type_records (status);

-- ---------- Adicionales ----------
create table public.additional_services (
  id uuid primary key default gen_random_uuid(),
  coordinator_id uuid not null references public.coordinators(id),
  cenlog_id uuid references public.cenlogs(id),
  service_type_id uuid not null references public.service_types(id),
  resources_count_range text not null check (resources_count_range in ('1-5', '6+')),
  resource_group_id uuid, -- agrupa varias filas cuando "1 a 5" genera un recurso por fila
  resource_name text,
  resource_document text,
  plate text,
  service_date date not null,
  transport_type_id uuid references public.transport_types(id),
  charge_description_id uuid references public.charge_descriptions(id),
  start_time time,
  end_time time,
  services_count integer not null default 0 check (services_count >= 0),
  delivery_support_note text,
  client_authorization_note text,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'reportado', 'aprobado', 'rechazado', 'facturado')),
  reverted_reason text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  is_active boolean not null default true,
  constraint chk_additional_services_time_range
    check (start_time is null or end_time is null or end_time >= start_time)
);
create index idx_additional_services_date on public.additional_services (service_date);
create index idx_additional_services_coordinator on public.additional_services (coordinator_id);
create index idx_additional_services_status on public.additional_services (status);
create index idx_additional_services_charge_desc on public.additional_services (charge_description_id);

-- ---------- Disponibilidades ----------
create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  coordinator_id uuid not null references public.coordinators(id),
  service_type_id uuid references public.service_types(id),
  quicker_name text not null,
  cedula text not null,
  plate text,
  services_count integer not null default 0 check (services_count >= 0),
  start_time time,
  end_time time,
  date date not null,
  payment numeric(14, 2) not null default 0,
  key_id uuid not null references public.keys(id),
  order_number text not null unique,
  observation text,
  status text not null default 'pendiente',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  is_active boolean not null default true,
  constraint chk_availabilities_time_range
    check (start_time is null or end_time is null or end_time >= start_time)
);
create index idx_availabilities_date on public.availabilities (date);
create index idx_availabilities_client on public.availabilities (client_id);
create index idx_availabilities_coordinator on public.availabilities (coordinator_id);
create index idx_availabilities_status on public.availabilities (status);

-- ---------- Adjuntos ----------
create table public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  record_id uuid not null,
  file_type text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);
create index idx_file_attachments_module_record on public.file_attachments (module, record_id);

-- ---------- Importaciones masivas ----------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  file_name text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  total_received integer not null default 0,
  total_success integer not null default 0,
  total_rejected integer not null default 0,
  total_duplicated integer not null default 0,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed'))
);
create index idx_import_batches_module on public.import_batches (module);

create table public.import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer,
  error_reason text not null,
  raw_data jsonb
);
create index idx_import_errors_batch on public.import_errors (batch_id);

-- ---------- Auditoria ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null
    check (action in ('create', 'update', 'delete', 'import', 'export', 'status_change', 'restore')),
  module text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_module_record on public.audit_logs (module, record_id);
create index idx_audit_logs_created_at on public.audit_logs (created_at);

-- ---------- Numero de orden seguro (Disponibilidades) ----------
create table public.daily_order_sequences (
  id uuid primary key default gen_random_uuid(),
  seq_date date not null,
  key_code text not null,
  last_sequence integer not null default 0,
  unique (seq_date, key_code)
);
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
-- =========================================================
-- Row Level Security
-- Patron: <modulo>.view / .create / .edit / .delete / .import / .export
-- Los catalogos son de lectura libre para cualquier usuario autenticado
-- (se necesitan para selectores) y de escritura solo con config.manage.
-- =========================================================

-- ---------- Helpers ----------
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid()
      and perm.code = p_code
      and p.is_active = true
  );
$$;

-- ---------- profiles ----------
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
  for select using (id = auth.uid() or public.has_permission('users.manage'));

create policy "profiles_insert" on public.profiles
  for insert with check (public.has_permission('users.manage'));

create policy "profiles_update" on public.profiles
  for update using (id = auth.uid() or public.has_permission('users.manage'))
  with check (id = auth.uid() or public.has_permission('users.manage'));

-- ---------- catalogos: lectura libre, escritura con config.manage ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'roles', 'permissions', 'role_permissions', 'clients', 'cities', 'cedis',
    'service_types', 'load_types', 'transport_types', 'charge_descriptions',
    'statuses', 'coordinators', 'cenlogs', 'nodes', 'keys'
  ]
  loop
    execute format('alter table public.%1$I enable row level security;', t);
    execute format(
      'create policy "%1$s_select" on public.%1$I for select using (auth.uid() is not null);',
      t
    );
    execute format(
      'create policy "%1$s_manage" on public.%1$I for all using (public.has_permission(''config.manage'')) with check (public.has_permission(''config.manage''));',
      t
    );
  end loop;
end;
$$;

-- ---------- collections ----------
alter table public.collections enable row level security;
create policy "collections_select" on public.collections for select using (public.has_permission('recoleccion.view'));
create policy "collections_insert" on public.collections for insert with check (public.has_permission('recoleccion.create'));
create policy "collections_update" on public.collections for update using (public.has_permission('recoleccion.edit')) with check (public.has_permission('recoleccion.edit'));
create policy "collections_delete" on public.collections for delete using (public.has_permission('recoleccion.delete'));

-- ---------- collection_manual_adjustments ----------
alter table public.collection_manual_adjustments enable row level security;
create policy "adjustments_select" on public.collection_manual_adjustments for select using (public.has_permission('dashboard.view'));
create policy "adjustments_insert" on public.collection_manual_adjustments for insert with check (public.has_permission('dashboard.adjust'));
create policy "adjustments_update" on public.collection_manual_adjustments for update using (public.has_permission('dashboard.adjust')) with check (public.has_permission('dashboard.adjust'));
create policy "adjustments_delete" on public.collection_manual_adjustments for delete using (public.has_permission('dashboard.adjust'));

-- ---------- reconciliations ----------
alter table public.reconciliations enable row level security;
create policy "reconciliations_select" on public.reconciliations for select using (public.has_permission('conciliacion.view'));
create policy "reconciliations_insert" on public.reconciliations for insert with check (public.has_permission('conciliacion.create'));
create policy "reconciliations_update" on public.reconciliations for update using (public.has_permission('conciliacion.edit')) with check (public.has_permission('conciliacion.edit'));
create policy "reconciliations_delete" on public.reconciliations for delete using (public.has_permission('conciliacion.delete'));

-- ---------- service_type_records ----------
alter table public.service_type_records enable row level security;
create policy "service_type_records_select" on public.service_type_records for select using (public.has_permission('tipo_servicio.view'));
create policy "service_type_records_insert" on public.service_type_records for insert with check (public.has_permission('tipo_servicio.create'));
create policy "service_type_records_update" on public.service_type_records for update using (public.has_permission('tipo_servicio.edit')) with check (public.has_permission('tipo_servicio.edit'));
create policy "service_type_records_delete" on public.service_type_records for delete using (public.has_permission('tipo_servicio.delete'));

-- ---------- additional_services ----------
alter table public.additional_services enable row level security;
create policy "additional_services_select" on public.additional_services for select using (public.has_permission('adicionales.view'));
create policy "additional_services_insert" on public.additional_services for insert with check (public.has_permission('adicionales.create'));
create policy "additional_services_update" on public.additional_services for update using (public.has_permission('adicionales.edit')) with check (public.has_permission('adicionales.edit'));
create policy "additional_services_delete" on public.additional_services for delete using (public.has_permission('adicionales.delete'));

-- ---------- availabilities ----------
alter table public.availabilities enable row level security;
create policy "availabilities_select" on public.availabilities for select using (public.has_permission('disponibilidades.view'));
create policy "availabilities_insert" on public.availabilities for insert with check (public.has_permission('disponibilidades.create'));
create policy "availabilities_update" on public.availabilities for update using (public.has_permission('disponibilidades.edit')) with check (public.has_permission('disponibilidades.edit'));
create policy "availabilities_delete" on public.availabilities for delete using (public.has_permission('disponibilidades.delete'));

-- ---------- file_attachments ----------
alter table public.file_attachments enable row level security;
create policy "file_attachments_select" on public.file_attachments for select using (public.has_permission('adicionales.view'));
create policy "file_attachments_insert" on public.file_attachments for insert with check (public.has_permission('adicionales.edit'));
create policy "file_attachments_delete" on public.file_attachments for delete using (public.has_permission('adicionales.edit'));

-- ---------- import_batches / import_errors ----------
alter table public.import_batches enable row level security;
create policy "import_batches_select" on public.import_batches for select using (
  user_id = auth.uid() or public.has_permission(module || '.import')
);
create policy "import_batches_insert" on public.import_batches for insert with check (
  public.has_permission(module || '.import')
);

alter table public.import_errors enable row level security;
create policy "import_errors_select" on public.import_errors for select using (
  exists (
    select 1 from public.import_batches b
    where b.id = batch_id
      and (b.user_id = auth.uid() or public.has_permission(b.module || '.import'))
  )
);

-- ---------- audit_logs: solo lectura, solo con permiso audit.view ----------
-- (los inserts los hace fn_audit_trigger, que corre con privilegios de
-- definer y por lo tanto no depende de estas politicas)
alter table public.audit_logs enable row level security;
create policy "audit_logs_select" on public.audit_logs for select using (public.has_permission('audit.view'));

-- ---------- daily_order_sequences: interno, sin acceso directo ----------
alter table public.daily_order_sequences enable row level security;
create policy "daily_order_sequences_select" on public.daily_order_sequences for select using (public.has_permission('disponibilidades.view'));
-- =========================================================
-- Datos iniciales
-- =========================================================

-- ---------- Roles ----------
insert into public.roles (name, description) values
  ('Administrador', 'Acceso total: visualizar, crear, editar, eliminar, importar, exportar y administrar usuarios'),
  ('Coordinador', 'Visualizar, crear, editar, importar, exportar y realizar cambios masivos'),
  ('Operador', 'Visualizar, crear, importar y editar registros permitidos'),
  ('Consulta', 'Solamente visualizar y descargar informacion')
on conflict (name) do nothing;

-- ---------- Permisos por modulo (view/create/edit/delete/import/export) ----------
insert into public.permissions (code, module, description)
select m.module || '.' || a.action, m.module, initcap(a.action) || ' - ' || m.module
from unnest(array['recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades']) as m(module)
cross join unnest(array['view', 'create', 'edit', 'delete', 'import', 'export']) as a(action)
on conflict (code) do nothing;

insert into public.permissions (code, module, description) values
  ('dashboard.view', 'dashboard', 'Ver dashboard'),
  ('dashboard.adjust', 'dashboard', 'Agregar ajuste manual en el dashboard'),
  ('config.manage', 'config', 'Administrar catalogos de configuracion'),
  ('users.manage', 'users', 'Administrar usuarios y roles'),
  ('audit.view', 'audit', 'Ver auditoria')
on conflict (code) do nothing;

-- ---------- Administrador: todos los permisos ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador'
on conflict do nothing;

-- ---------- Coordinador: view/create/edit/import/export + dashboard ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Coordinador'
  and (
    (p.module in ('recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades')
     and split_part(p.code, '.', 2) in ('view', 'create', 'edit', 'import', 'export'))
    or p.code in ('dashboard.view', 'dashboard.adjust')
  )
on conflict do nothing;

-- ---------- Operador: view/create/import/edit + dashboard.view ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Operador'
  and (
    (p.module in ('recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades')
     and split_part(p.code, '.', 2) in ('view', 'create', 'import', 'edit'))
    or p.code = 'dashboard.view'
  )
on conflict do nothing;

-- ---------- Consulta: view/export + dashboard.view ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Consulta'
  and (
    (p.module in ('recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades')
     and split_part(p.code, '.', 2) in ('view', 'export'))
    or p.code = 'dashboard.view'
  )
on conflict do nothing;

-- ---------- Clientes iniciales ----------
insert into public.clients (name) values ('Colsubsidio'), ('Plintron')
on conflict do nothing;

-- ---------- Ciudades iniciales ----------
insert into public.cities (name) values ('Barranquilla'), ('Ibagué'), ('Armenia'), ('Cali')
on conflict do nothing;

-- ---------- Tipos de carga iniciales ----------
insert into public.load_types (name) values ('Nevera'), ('Periferia'), ('Volumen')
on conflict do nothing;

-- ---------- Tipos de servicio (Adicionales) ----------
insert into public.service_types (scope, name) values
  ('adicionales', 'Cross Docking'),
  ('adicionales', 'Institucional'),
  ('adicionales', 'Comercial')
on conflict do nothing;

-- ---------- Tipos de transporte ----------
insert into public.transport_types (name) values ('Carry'), ('Moto')
on conflict do nothing;

-- ---------- Descripciones de cobro ----------
insert into public.charge_descriptions (name) values
  ('Adicional'), ('Adicional + Periferia'), ('Hora extra'),
  ('Personal de planta'), ('Periferia'), ('Vuelta')
on conflict do nothing;

-- ---------- Estados (catalogo de presentacion) ----------
insert into public.statuses (module, code, label, color) values
  ('conciliacion', 'no_conciliado', 'No conciliado', 'gray'),
  ('conciliacion', 'conciliado', 'Conciliado', 'green'),
  ('tipo_servicio', 'no_facturado', 'No facturado', 'gray'),
  ('tipo_servicio', 'facturado', 'Facturado', 'blue'),
  ('adicionales', 'pendiente', 'Pendiente', 'gray'),
  ('adicionales', 'reportado', 'Reportado', 'yellow'),
  ('adicionales', 'aprobado', 'Aprobado', 'green'),
  ('adicionales', 'rechazado', 'Rechazado', 'red'),
  ('adicionales', 'facturado', 'Facturado', 'blue'),
  ('disponibilidades', 'pendiente', 'Pendiente', 'gray'),
  ('disponibilidades', 'confirmada', 'Confirmada', 'green'),
  ('disponibilidades', 'cancelada', 'Cancelada', 'red')
on conflict do nothing;
-- =========================================================
-- Fase 2 - Recoleccion
-- =========================================================

-- Las columnas created_by/updated_by/deleted_by apuntaban a auth.users, que
-- PostgREST no puede "embeber" en una consulta (no es una tabla publica).
-- Se re-apuntan a public.profiles(id) -que tiene el mismo valor- para poder
-- traer el nombre de "Usuario de registro / modificacion" en una sola
-- consulta en vez de una consulta aparte por cada fila.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('collections', 'created_by'), ('collections', 'updated_by'), ('collections', 'deleted_by'),
      ('collection_manual_adjustments', 'created_by'), ('collection_manual_adjustments', 'updated_by'), ('collection_manual_adjustments', 'deleted_by'),
      ('reconciliations', 'created_by'), ('reconciliations', 'updated_by'), ('reconciliations', 'deleted_by'),
      ('service_type_records', 'created_by'), ('service_type_records', 'updated_by'), ('service_type_records', 'deleted_by'),
      ('additional_services', 'created_by'), ('additional_services', 'updated_by'), ('additional_services', 'deleted_by'),
      ('availabilities', 'created_by'), ('availabilities', 'updated_by'), ('availabilities', 'deleted_by'),
      ('file_attachments', 'uploaded_by'),
      ('import_batches', 'user_id'),
      ('audit_logs', 'user_id')
    ) as x(table_name, column_name)
  loop
    execute format(
      'alter table public.%1$I drop constraint if exists %1$s_%2$s_fkey;
       alter table public.%1$I add constraint %1$s_%2$s_fkey foreign key (%2$I) references public.profiles(id);',
      t.table_name, t.column_name
    );
  end loop;
end;
$$;

-- La eliminacion es logica (UPDATE de deleted_at/deleted_by, no DELETE real),
-- asi que la politica de UPDATE debe aceptar tanto a quien puede editar como
-- a quien puede eliminar.
drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
  with check (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'));

-- Ampliar lectura de profiles: cualquier usuario autenticado puede ver
-- nombre/correo/rol de sus compañeros (necesario para mostrar "Usuario de
-- registro" / "Usuario de modificación" en las tablas). Escribir/editar
-- perfiles sigue restringido a uno mismo o a quien tenga users.manage.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

-- Totales (cantidad de registros + suma de recaudo) para el conjunto de
-- resultados filtrado completo, no solo la página visible. Se calcula en la
-- base de datos para no tener que traer miles de filas al navegador.
create or replace function public.collections_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_service_type_id uuid default null,
  p_load_type_id uuid default null,
  p_reconciliation_status text default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.collections c
  where c.deleted_at is null
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_service_type_id is null or c.service_type_id = p_service_type_id)
    and (p_load_type_id is null or c.load_type_id = p_load_type_id)
    and (p_reconciliation_status is null or c.reconciliation_status = p_reconciliation_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;
-- =========================================================
-- Fase 2 - Ajustes: quitar "Tipo de servicio" de Recoleccion,
-- ampliar catalogo de Tipo de carga, filtro multi-seleccion.
-- =========================================================

-- "Tipo de servicio" en Recoleccion quedaba redundante con "Tipo de carga".
alter table public.collections drop column if exists service_type_id;

-- Nuevos valores del catalogo de tipos de carga.
insert into public.load_types (name) values ('Entrega'), ('Carga Seca')
on conflict do nothing;

-- collections_totals: se quita el filtro por tipo de servicio (columna
-- eliminada) y el de tipo de carga pasa a aceptar varios valores a la vez.
drop function if exists public.collections_totals(text, date, date, uuid, uuid, uuid, uuid, text);

create or replace function public.collections_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.collections c
  where c.deleted_at is null
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_reconciliation_status is null or c.reconciliation_status = p_reconciliation_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;
-- =========================================================
-- Fase 2 - Carga masiva de Recoleccion
-- =========================================================

-- Nuevos campos que vienen en el texto pegado desde Excel/Sheets:
-- "nombre cliente" (nombre de la persona en el servicio, no el cliente
-- corporativo) y "novedad" (observacion libre).
alter table public.collections add column if not exists client_name text;
alter table public.collections add column if not exists note text;

-- El buscador general de la tabla tambien debe encontrar por "nombre cliente".
create or replace function public.collections_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.collections c
  where c.deleted_at is null
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_reconciliation_status is null or c.reconciliation_status = p_reconciliation_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_name ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;

-- La carga masiva tambien es una forma de "crear" registros: la politica de
-- insert debe aceptar tanto a quien puede crear manualmente como a quien
-- puede importar.
drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import'));

-- Faltaba la politica de insert para el detalle de errores de importacion.
drop policy if exists "import_errors_insert" on public.import_errors;
create policy "import_errors_insert" on public.import_errors
  for insert
  with check (
    exists (
      select 1 from public.import_batches b
      where b.id = batch_id and b.user_id = auth.uid()
    )
  );
-- =========================================================
-- Fase 2 - Visitas (guias repetidas) y Oportunidad (dias sin conciliar)
-- =========================================================

-- Cuenta cuantas veces se ha cargado la misma guia (numero de servicio) para
-- un cliente. Nace en 1; la carga masiva la incrementa cuando encuentra una
-- guia que ya existia, en vez de crear una fila repetida.
alter table public.collections add column if not exists visits integer not null default 1;

-- Incremento atomico de "visits" para las guias que ya existian al momento
-- de una carga masiva (evita condiciones de carrera entre cargas simultaneas).
create or replace function public.increment_collection_visits(
  p_client_id uuid,
  p_service_numbers text[]
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.collections
  set visits = visits + 1
  where client_id = p_client_id
    and service_number = any(p_service_numbers)
    and deleted_at is null;
$$;
-- =========================================================
-- Fase 3 - Conciliacion
-- =========================================================

-- Igual que en Recoleccion: "Nombre del cliente" es el nombre de la persona
-- en el servicio, no el cliente corporativo (que sigue siendo client_id).
alter table public.reconciliations add column if not exists client_name text;

-- La insercion (alta manual o carga masiva) debe aceptar tanto a quien puede
-- crear como a quien puede importar.
drop policy if exists "reconciliations_insert" on public.reconciliations;
create policy "reconciliations_insert" on public.reconciliations
  for insert
  with check (public.has_permission('conciliacion.create') or public.has_permission('conciliacion.import'));

-- La eliminacion es logica (UPDATE de deleted_at/deleted_by, no DELETE real).
drop policy if exists "reconciliations_update" on public.reconciliations;
create policy "reconciliations_update" on public.reconciliations
  for update
  using (public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete'))
  with check (public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete'));

-- Totales (cantidad de registros + suma de recaudo) del conjunto filtrado
-- completo, igual que collections_totals.
create or replace function public.reconciliations_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.reconciliations r
  where r.deleted_at is null
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_match_status is null or r.match_status = p_match_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_reconciliation_date_from is null or r.reconciliation_date >= p_reconciliation_date_from)
    and (p_reconciliation_date_to is null or r.reconciliation_date <= p_reconciliation_date_to)
    and (
      p_search is null or p_search = '' or
      r.service_number ilike '%' || p_search || '%' or
      r.client_name ilike '%' || p_search || '%' or
      r.client_document ilike '%' || p_search || '%' or
      r.cedi_name ilike '%' || p_search || '%'
    );
$$;

-- Revierte el cruce: se usa al editar o eliminar una conciliacion, para que
-- la recoleccion enlazada no quede "Conciliado" apuntando a un registro que
-- ya cambio o fue eliminado.
create or replace function public.unreconcile_collection(p_reconciliation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.collections
  set reconciliation_status = 'no_conciliado',
      reconciliation_id = null,
      reconciled_at = null
  where reconciliation_id = p_reconciliation_id;
end;
$$;

-- Ejecuta el cruce automatico (reconcile_collection) para varias
-- conciliaciones en una sola llamada, para no ir y volver del servidor una
-- vez por cada fila de una carga masiva.
create or replace function public.reconcile_collections_batch(p_reconciliation_ids uuid[])
returns table (reconciliation_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  foreach rid in array p_reconciliation_ids loop
    reconciliation_id := rid;
    status := public.reconcile_collection(rid);
    return next;
  end loop;
end;
$$;
-- =========================================================
-- Ajustes: no duplicar guias en Conciliacion, corregir el
-- desfase de columnas de su carga masiva, y filtro de Oportunidad
-- en Recoleccion.
-- =========================================================

-- Al igual que en Recoleccion, una misma guia no puede conciliarse dos veces
-- para el mismo cliente.
create unique index if not exists uq_reconciliations_service_number
  on public.reconciliations (client_id, service_number) where deleted_at is null;

-- Faltaba el campo de tipo de carga (la carga masiva traia esta columna y,
-- al no existir, desplazaba "documento cliente" y "recaudo" una posicion).
alter table public.reconciliations add column if not exists load_type_id uuid references public.load_types(id);

-- IDs de recolecciones que llevan N dias o mas sin conciliar (para el
-- filtro "Oportunidad"). Se compara por fecha calendario en hora de
-- Colombia, igual que en la pantalla.
create or replace function public.collections_opportunity_ids(p_min_days integer)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.collections
  where deleted_at is null
    and reconciliation_status = 'no_conciliado'
    and (
      ((now() at time zone 'America/Bogota')::date)
      - ((created_at at time zone 'America/Bogota')::date)
    ) >= p_min_days;
$$;

-- collections_totals ahora tambien puede acotarse a una lista de ids
-- puntual (usada por el filtro de Oportunidad).
drop function if exists public.collections_totals(text, date, date, uuid, uuid, uuid[], text);

create or replace function public.collections_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null,
  p_ids uuid[] default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.collections c
  where c.deleted_at is null
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_reconciliation_status is null or c.reconciliation_status = p_reconciliation_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_ids is null or c.id = any(p_ids))
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_name ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;
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
-- =========================================================
-- Fase 5 - Tipo de Servicio
-- =========================================================

-- Igual que en Recoleccion/Conciliacion: apuntar a public.profiles(id) en
-- vez de auth.users(id) para poder traer el nombre de "Usuario de registro /
-- modificacion" en una sola consulta.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('service_type_records', 'created_by'),
      ('service_type_records', 'updated_by'),
      ('service_type_records', 'deleted_by')
    ) as x(table_name, column_name)
  loop
    execute format(
      'alter table public.%1$I drop constraint if exists %1$s_%2$s_fkey;
       alter table public.%1$I add constraint %1$s_%2$s_fkey foreign key (%2$I) references public.profiles(id);',
      t.table_name, t.column_name
    );
  end loop;
end;
$$;

-- La insercion (alta manual o carga masiva) debe aceptar tanto a quien
-- puede crear como a quien puede importar.
drop policy if exists "service_type_records_insert" on public.service_type_records;
create policy "service_type_records_insert" on public.service_type_records
  for insert
  with check (public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import'));

-- La eliminacion es logica (UPDATE de deleted_at/deleted_by, no DELETE real).
drop policy if exists "service_type_records_update" on public.service_type_records;
create policy "service_type_records_update" on public.service_type_records
  for update
  using (public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete'))
  with check (public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete'));

-- Totales (cantidad de registros + suma de valor) del conjunto filtrado
-- completo, igual que en los otros modulos.
create or replace function public.service_type_records_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_status text default null
)
returns table (total_count bigint, total_value numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(value), 0)::numeric
  from public.service_type_records s
  where s.deleted_at is null
    and (p_client_id is null or s.client_id = p_client_id)
    and (p_city_id is null or s.city_id = p_city_id)
    and (p_load_type_ids is null or s.load_type_id = any(p_load_type_ids))
    and (p_status is null or s.status = p_status)
    and (p_date_from is null or s.record_date >= p_date_from)
    and (p_date_to is null or s.record_date <= p_date_to)
    and (p_search is null or p_search = '' or s.guide ilike '%' || p_search || '%');
$$;

-- Ids de todos los registros que cumplen los filtros (para "seleccionar
-- todos los N encontrados", no solo los visibles en la pagina).
create or replace function public.service_type_records_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.service_type_records s
  where s.deleted_at is null
    and (p_client_id is null or s.client_id = p_client_id)
    and (p_city_id is null or s.city_id = p_city_id)
    and (p_load_type_ids is null or s.load_type_id = any(p_load_type_ids))
    and (p_status is null or s.status = p_status)
    and (p_date_from is null or s.record_date >= p_date_from)
    and (p_date_to is null or s.record_date <= p_date_to)
    and (p_search is null or p_search = '' or s.guide ilike '%' || p_search || '%');
$$;

-- Solo un Administrador puede revertir un registro de Facturado a No
-- facturado (el resto de roles con tipo_servicio.edit puede facturar, pero
-- no revertir).
insert into public.permissions (code, module, description) values
  ('tipo_servicio.revert', 'tipo_servicio', 'Revertir un registro de Facturado a No facturado')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador' and p.code = 'tipo_servicio.revert'
on conflict do nothing;

-- Cambio masivo de estado. Solo permite "facturar" registros que ya estan
-- "no_facturado" a menos que sea una reversion explicita con motivo, y solo
-- toca las filas que el usuario puede editar (RLS filtra el resto).
create or replace function public.service_type_records_bulk_set_status(
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
  if p_status not in ('facturado', 'no_facturado') then
    raise exception 'Estado invalido: %', p_status;
  end if;

  if p_status = 'no_facturado' then
    if p_reverted_reason is null or trim(p_reverted_reason) = '' then
      raise exception 'Debes indicar un motivo para revertir a No facturado';
    end if;
    if not public.has_permission('tipo_servicio.revert') then
      raise exception 'Solo un Administrador puede revertir un registro a No facturado';
    end if;
  end if;

  update public.service_type_records
  set status = p_status,
      reverted_reason = case when p_status = 'no_facturado' then p_reverted_reason else reverted_reason end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cambio masivo de tipo de carga (solo aplica a registros no facturados).
create or replace function public.service_type_records_bulk_set_load_type(
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
  update public.service_type_records
  set load_type_id = p_load_type_id
  where id = any(p_ids)
    and deleted_at is null
    and status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Eliminacion logica masiva. Igual que la eliminacion individual, un
-- registro Facturado no se puede eliminar (solo los que sigan "no_facturado").
create or replace function public.service_type_records_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.service_type_records
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
-- =========================================================
-- Fase 5 (correccion) - Tipo de Servicio pasa a ser una vista
-- filtrada de Recoleccion (mismo registro), no una tabla aparte.
-- =========================================================

-- La tabla independiente que se creo antes no llego a usarse con datos
-- reales; se elimina junto con sus funciones especificas.
drop function if exists public.service_type_records_totals(text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_records_matching_ids(text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_records_bulk_set_status(uuid[], text, text);
drop function if exists public.service_type_records_bulk_set_load_type(uuid[], uuid);
drop function if exists public.service_type_records_bulk_delete(uuid[]);
drop table if exists public.service_type_records;

-- Campos propios de Tipo de Servicio, agregados directamente sobre
-- collections: es el mismo registro de Recoleccion, visto con informacion
-- adicional (Nodo, Operacion, si ya fue Facturado).
alter table public.collections add column if not exists node_id uuid references public.nodes(id);
alter table public.collections add column if not exists operation text;
alter table public.collections add column if not exists billing_status text not null default 'no_facturado'
  check (billing_status in ('facturado', 'no_facturado'));
alter table public.collections add column if not exists billing_reverted_reason text;

-- Recoleccion y Tipo de Servicio comparten la misma tabla: las politicas de
-- collections deben aceptar los permisos de cualquiera de los dos modulos.
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select
  using (public.has_permission('recoleccion.view') or public.has_permission('tipo_servicio.view'));

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (
    public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import')
    or public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import')
  );

drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (
    public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  )
  with check (
    public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  );

-- Totales (cantidad + suma de valor) para la vista de Tipo de Servicio:
-- collections filtrado a los tipos de carga que le corresponden a este
-- modulo (Nevera, Periferia, Volumen), mas los filtros propios de la vista.
create or replace function public.service_type_view_totals(
  p_relevant_load_type_ids uuid[],
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_billing_status text default null
)
returns table (total_count bigint, total_value numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.collections c
  where c.deleted_at is null
    and c.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or c.billing_status = p_billing_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_search is null or p_search = '' or c.service_number ilike '%' || p_search || '%');
$$;

-- Ids de todos los registros que cumplen los filtros (para "seleccionar
-- todos los N encontrados").
create or replace function public.service_type_view_matching_ids(
  p_relevant_load_type_ids uuid[],
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_billing_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.collections c
  where c.deleted_at is null
    and c.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or c.billing_status = p_billing_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_search is null or p_search = '' or c.service_number ilike '%' || p_search || '%');
$$;

-- Cambio de estado de facturacion (uno o varios a la vez). Revertir a
-- "no_facturado" exige motivo y el permiso tipo_servicio.revert
-- (Administrador).
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
  if p_status not in ('facturado', 'no_facturado') then
    raise exception 'Estado invalido: %', p_status;
  end if;

  if p_status = 'no_facturado' then
    if p_reverted_reason is null or trim(p_reverted_reason) = '' then
      raise exception 'Debes indicar un motivo para revertir a No facturado';
    end if;
    if not public.has_permission('tipo_servicio.revert') then
      raise exception 'Solo un Administrador puede revertir un registro a No facturado';
    end if;
  end if;

  update public.collections
  set billing_status = p_status,
      billing_reverted_reason = case when p_status = 'no_facturado' then p_reverted_reason else billing_reverted_reason end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cambio masivo de tipo de carga (solo registros no facturados).
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
  update public.collections
  set load_type_id = p_load_type_id
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Eliminacion logica masiva. Al ser el mismo registro de Recoleccion,
-- eliminarlo aqui tambien lo quita de esa vista. Los Facturados no se
-- pueden eliminar.
create or replace function public.service_type_bulk_delete(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.collections
  set deleted_at = now(), deleted_by = auth.uid()
  where id = any(p_ids)
    and deleted_at is null
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
-- =========================================================
-- Fase 5 (segunda correccion) - Tipo de Servicio pasa a ser una
-- vista filtrada de CONCILIACION (no de Recoleccion): mismo registro,
-- porque la fecha de servicio real es la que trae la conciliacion.
-- =========================================================

-- Revertir lo que se agrego sobre collections para el intento anterior:
-- Nodo y Operacion no estaban en la lista de campos real, y el estado de
-- facturacion ahora vive en reconciliations.
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select using (public.has_permission('recoleccion.view'));

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import'));

drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
  with check (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'));

drop function if exists public.service_type_view_totals(uuid[], text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_view_matching_ids(uuid[], text, date, date, uuid, uuid, uuid[], text);
drop function if exists public.service_type_bulk_set_billing_status(uuid[], text, text);
drop function if exists public.service_type_bulk_set_load_type(uuid[], uuid);
drop function if exists public.service_type_bulk_delete(uuid[]);

alter table public.collections drop column if exists node_id;
alter table public.collections drop column if exists operation;
alter table public.collections drop column if exists billing_status;
alter table public.collections drop column if exists billing_reverted_reason;

-- El estado de facturacion de Tipo de Servicio vive en reconciliations,
-- que es su verdadera fuente.
alter table public.reconciliations add column if not exists billing_status text not null default 'no_facturado'
  check (billing_status in ('facturado', 'no_facturado'));
alter table public.reconciliations add column if not exists billing_reverted_reason text;

-- reconciliations ahora sirve a dos modulos (Conciliacion y Tipo de
-- Servicio): las politicas deben aceptar los permisos de cualquiera.
drop policy if exists "reconciliations_select" on public.reconciliations;
create policy "reconciliations_select" on public.reconciliations
  for select
  using (public.has_permission('conciliacion.view') or public.has_permission('tipo_servicio.view'));

drop policy if exists "reconciliations_insert" on public.reconciliations;
create policy "reconciliations_insert" on public.reconciliations
  for insert
  with check (
    public.has_permission('conciliacion.create') or public.has_permission('conciliacion.import')
    or public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import')
  );

drop policy if exists "reconciliations_update" on public.reconciliations;
create policy "reconciliations_update" on public.reconciliations
  for update
  using (
    public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  )
  with check (
    public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
    or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
  );

-- Totales (cantidad + suma de recaudo) para la vista de Tipo de Servicio:
-- reconciliations filtrado a los tipos de carga de este modulo (Nevera,
-- Periferia, Volumen), mas los filtros propios de la vista.
create or replace function public.service_type_view_totals(
  p_relevant_load_type_ids uuid[],
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_billing_status text default null
)
returns table (total_count bigint, total_value numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.reconciliations r
  where r.deleted_at is null
    and r.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_load_type_ids is null or r.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or r.billing_status = p_billing_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_search is null or p_search = '' or r.service_number ilike '%' || p_search || '%');
$$;

create or replace function public.service_type_view_matching_ids(
  p_relevant_load_type_ids uuid[],
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_billing_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.reconciliations r
  where r.deleted_at is null
    and r.load_type_id = any(p_relevant_load_type_ids)
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_load_type_ids is null or r.load_type_id = any(p_load_type_ids))
    and (p_billing_status is null or r.billing_status = p_billing_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_search is null or p_search = '' or r.service_number ilike '%' || p_search || '%');
$$;

-- Cambio de estado de facturacion (individual o masivo). Revertir a
-- "no_facturado" exige motivo y permiso de Administrador.
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
  if p_status not in ('facturado', 'no_facturado') then
    raise exception 'Estado invalido: %', p_status;
  end if;

  if p_status = 'no_facturado' then
    if p_reverted_reason is null or trim(p_reverted_reason) = '' then
      raise exception 'Debes indicar un motivo para revertir a No facturado';
    end if;
    if not public.has_permission('tipo_servicio.revert') then
      raise exception 'Solo un Administrador puede revertir un registro a No facturado';
    end if;
  end if;

  update public.reconciliations
  set billing_status = p_status,
      billing_reverted_reason = case when p_status = 'no_facturado' then p_reverted_reason else billing_reverted_reason end
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cambio masivo de tipo de carga (solo registros no facturados).
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
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Eliminacion logica masiva (deshace el cruce con Recoleccion antes de
-- eliminar, igual que en Conciliacion). Los Facturados no se eliminan.
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
    and billing_status = 'no_facturado';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
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
-- =========================================================
-- Fase 6 (ajustes) - Adicionales
-- Quien puede crear una solicitud de Adicionales tambien puede agregar un
-- Coordinador o CENLOG nuevo a la lista si no existe todavia, directamente
-- desde el formulario (sin pasar por la administracion de catalogos). Editar
-- o eliminar un coordinador/CENLOG existente sigue exigiendo config.manage,
-- igual que el resto de catalogos.
-- =========================================================

drop policy if exists "coordinators_manage" on public.coordinators;
create policy "coordinators_insert" on public.coordinators
  for insert
  with check (public.has_permission('config.manage') or public.has_permission('adicionales.create'));
create policy "coordinators_update" on public.coordinators
  for update using (public.has_permission('config.manage')) with check (public.has_permission('config.manage'));
create policy "coordinators_delete" on public.coordinators
  for delete using (public.has_permission('config.manage'));

drop policy if exists "cenlogs_manage" on public.cenlogs;
create policy "cenlogs_insert" on public.cenlogs
  for insert
  with check (public.has_permission('config.manage') or public.has_permission('adicionales.create'));
create policy "cenlogs_update" on public.cenlogs
  for update using (public.has_permission('config.manage')) with check (public.has_permission('config.manage'));
create policy "cenlogs_delete" on public.cenlogs
  for delete using (public.has_permission('config.manage'));
-- =========================================================
-- Recoleccion: "seleccionar todos los filtrados" para la eliminacion masiva
-- (mismos filtros que collections_totals, pero devuelve los ids en vez de
-- los totales, igual que el patron ya usado en Tipo de Servicio).
-- =========================================================
create or replace function public.collections_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_load_type_ids uuid[] default null,
  p_reconciliation_status text default null,
  p_ids uuid[] default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.collections c
  where c.deleted_at is null
    and (p_client_id is null or c.client_id = p_client_id)
    and (p_city_id is null or c.city_id = p_city_id)
    and (p_load_type_ids is null or c.load_type_id = any(p_load_type_ids))
    and (p_reconciliation_status is null or c.reconciliation_status = p_reconciliation_status)
    and (p_date_from is null or c.service_date >= p_date_from)
    and (p_date_to is null or c.service_date <= p_date_to)
    and (p_ids is null or c.id = any(p_ids))
    and (
      p_search is null or p_search = '' or
      c.service_number ilike '%' || p_search || '%' or
      c.client_name ilike '%' || p_search || '%' or
      c.client_document ilike '%' || p_search || '%' or
      c.cedi_name ilike '%' || p_search || '%'
    );
$$;
-- =========================================================
-- Conciliacion: seleccion masiva y eliminacion masiva (mismo patron que se
-- agrego en Recoleccion). "Seleccionar todos los filtrados" usa los mismos
-- filtros que reconciliations_totals, pero devuelve los ids.
-- =========================================================
create or replace function public.reconciliations_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select r.id
  from public.reconciliations r
  where r.deleted_at is null
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_match_status is null or r.match_status = p_match_status)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_reconciliation_date_from is null or r.reconciliation_date >= p_reconciliation_date_from)
    and (p_reconciliation_date_to is null or r.reconciliation_date <= p_reconciliation_date_to)
    and (
      p_search is null or p_search = '' or
      r.service_number ilike '%' || p_search || '%' or
      r.client_name ilike '%' || p_search || '%' or
      r.client_document ilike '%' || p_search || '%' or
      r.cedi_name ilike '%' || p_search || '%'
    );
$$;

-- Deshace el cruce con Recoleccion (igual que al eliminar una por una) antes
-- de la eliminacion logica masiva.
create or replace function public.reconciliations_bulk_delete(p_ids uuid[])
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
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
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
-- =========================================================
-- El tipo de carga se llama "Neveras" (plural), no "Nevera". Se renombra el
-- registro existente (no se borra e inserta de nuevo) para no perder el id
-- que ya usan las recolecciones/conciliaciones cargadas.
-- =========================================================
update public.load_types set name = 'Neveras' where lower(name) = 'nevera';
-- =========================================================
-- Recoleccion: nuevo campo "Conductor" (nombre del conductor asignado al
-- servicio), que si viene en la carga masiva real del usuario.
-- =========================================================
alter table public.collections add column if not exists driver_name text;
-- =========================================================
-- Panel de administracion de Usuarios y Roles (Configuraciones > Roles /
-- Usuarios). roles, permissions, role_permissions y profiles ya existian
-- desde la Fase 1; aqui solo se corrige el permiso que protege su
-- escritura: administrar roles/permisos es "users.manage" (tal como dice
-- la descripcion de ese permiso: "Administrar usuarios y roles"), no
-- "config.manage" (que quedo mal puesto porque roles/permissions viajaban
-- en el mismo loop generico que los catalogos de Recoleccion/Adicionales).
-- =========================================================

drop policy if exists "roles_manage" on public.roles;
create policy "roles_manage" on public.roles
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists "permissions_manage" on public.permissions;
create policy "permissions_manage" on public.permissions
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists "role_permissions_manage" on public.role_permissions;
create policy "role_permissions_manage" on public.role_permissions
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));
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
-- =========================================================
-- Roles Lider y Jefe + restriccion de ciudad por usuario.
--
-- - profile_cities: ciudades asignadas a un usuario (ej. un Coordinador).
--   Si un usuario NO tiene ninguna fila aqui, no tiene restriccion (ve todo,
--   igual que hoy). Si tiene una o mas, solo ve datos de esas ciudades en
--   Recoleccion, Conciliacion/Tipo de Servicio y Adicionales (via CEDI).
-- - Roles Lider y Jefe: ven todo (sin restriccion de ciudad) y pueden operar
--   el estado de Disponibilidades: Lider aprueba pero no autoriza; Jefe
--   aprueba y autoriza (y puede revertir).
-- =========================================================

-- ---------- Ciudades asignadas a un usuario ----------
create table if not exists public.profile_cities (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete cascade,
  primary key (profile_id, city_id)
);
create index if not exists idx_profile_cities_profile on public.profile_cities (profile_id);

alter table public.profile_cities enable row level security;

drop policy if exists "profile_cities_select" on public.profile_cities;
create policy "profile_cities_select" on public.profile_cities
  for select using (profile_id = auth.uid() or public.has_permission('users.manage'));

drop policy if exists "profile_cities_manage" on public.profile_cities;
create policy "profile_cities_manage" on public.profile_cities
  for all using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

-- Ciudades asignadas al usuario actual (vacio = sin restriccion, ve todo).
create or replace function public.current_user_city_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(city_id), '{}'::uuid[]) from public.profile_cities where profile_id = auth.uid();
$$;

create or replace function public.user_has_city_restriction()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profile_cities where profile_id = auth.uid());
$$;

-- ---------- Recoleccion: agregar restriccion de ciudad ----------
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select using (
    public.has_permission('recoleccion.view')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert
  with check (
    (public.has_permission('recoleccion.create') or public.has_permission('recoleccion.import'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "collections_update" on public.collections;
create policy "collections_update" on public.collections
  for update
  using (
    (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    (public.has_permission('recoleccion.edit') or public.has_permission('recoleccion.delete'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

-- ---------- Conciliacion / Tipo de Servicio: agregar restriccion de ciudad ----------
drop policy if exists "reconciliations_select" on public.reconciliations;
create policy "reconciliations_select" on public.reconciliations
  for select
  using (
    (public.has_permission('conciliacion.view') or public.has_permission('tipo_servicio.view'))
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "reconciliations_insert" on public.reconciliations;
create policy "reconciliations_insert" on public.reconciliations
  for insert
  with check (
    (
      public.has_permission('conciliacion.create') or public.has_permission('conciliacion.import')
      or public.has_permission('tipo_servicio.create') or public.has_permission('tipo_servicio.import')
    )
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "reconciliations_update" on public.reconciliations;
create policy "reconciliations_update" on public.reconciliations
  for update
  using (
    (
      public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
      or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
    )
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    (
      public.has_permission('conciliacion.edit') or public.has_permission('conciliacion.delete')
      or public.has_permission('tipo_servicio.edit') or public.has_permission('tipo_servicio.delete')
    )
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

-- ---------- Adicionales: restriccion de ciudad via CEDI (cedi_id -> cedis.city_id) ----------
drop policy if exists "additional_services_select" on public.additional_services;
create policy "additional_services_select" on public.additional_services
  for select using (
    public.has_permission('adicionales.view')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

drop policy if exists "additional_services_insert" on public.additional_services;
create policy "additional_services_insert" on public.additional_services
  for insert
  with check (
    public.has_permission('adicionales.create')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

drop policy if exists "additional_services_update" on public.additional_services;
create policy "additional_services_update" on public.additional_services
  for update
  using (
    public.has_permission('adicionales.edit')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  )
  with check (
    public.has_permission('adicionales.edit')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

drop policy if exists "additional_services_delete" on public.additional_services;
create policy "additional_services_delete" on public.additional_services
  for delete using (
    public.has_permission('adicionales.delete')
    and (
      not public.user_has_city_restriction()
      or cedi_id in (select id from public.cedis where city_id = any(public.current_user_city_ids()))
    )
  );

-- ---------- Roles Lider y Jefe ----------
insert into public.roles (name, description) values
  ('Líder', 'Ve todos los registros de todas las ciudades. Puede aprobar disponibilidades, no autorizar.'),
  ('Jefe', 'Ve todos los registros de todas las ciudades. Puede aprobar y autorizar disponibilidades.')
on conflict (name) do nothing;

-- ---------- Permiso separado para autorizar (aprobar ya existia) ----------
insert into public.permissions (code, module, description) values
  ('disponibilidades.authorize', 'disponibilidades', 'Autorizar (y revertir) un registro de disponibilidad; incluye aprobar')
on conflict (code) do nothing;

update public.permissions
set description = 'Aprobar un registro de disponibilidad (de Registrado a Aprobado)'
where code = 'disponibilidades.approve';

-- El permiso disponibilidades.authorize se creo despues del seed original de
-- Administrador ("todos los permisos"), asi que se le otorga explicitamente.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador' and p.code = 'disponibilidades.authorize'
on conflict do nothing;

-- Lider: ver todos los modulos + aprobar disponibilidades.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Líder'
  and (p.code like '%.view' or p.code = 'disponibilidades.approve')
on conflict do nothing;

-- Jefe: igual que Lider, mas autorizar.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Jefe'
  and (p.code like '%.view' or p.code = 'disponibilidades.approve' or p.code = 'disponibilidades.authorize')
on conflict do nothing;

-- ---------- Cambio de estado: aprobar exige "approve" o "authorize";        ----------
-- ---------- autorizar y revertir a "registrado" exigen "authorize".        ----------
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

  if p_status = 'aprobado' then
    if not (public.has_permission('disponibilidades.approve') or public.has_permission('disponibilidades.authorize')) then
      raise exception 'No tienes permiso para aprobar';
    end if;
  elsif p_status = 'autorizado' then
    if not public.has_permission('disponibilidades.authorize') then
      raise exception 'Solo un Jefe puede autorizar';
    end if;
  elsif p_status = 'registrado' then
    if not public.has_permission('disponibilidades.authorize') then
      raise exception 'Solo un Jefe puede revertir a Registrado';
    end if;
  end if;

  update public.availabilities
  set status = p_status
  where id = any(p_ids)
    and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
-- =========================================================
-- El Dashboard combina collections + collection_manual_adjustments
-- (dashboard_operacion_detail es security invoker, así que ya respeta RLS
-- de ambas tablas). A collections ya se le agregó la restricción de ciudad;
-- faltaba agregarla también a collection_manual_adjustments, si no un
-- ajuste manual de otra ciudad se seguía colando en el Dashboard de un
-- usuario restringido.
-- =========================================================

drop policy if exists "adjustments_select" on public.collection_manual_adjustments;
create policy "adjustments_select" on public.collection_manual_adjustments
  for select using (
    public.has_permission('dashboard.view')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "adjustments_insert" on public.collection_manual_adjustments;
create policy "adjustments_insert" on public.collection_manual_adjustments
  for insert
  with check (
    public.has_permission('dashboard.adjust')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "adjustments_update" on public.collection_manual_adjustments;
create policy "adjustments_update" on public.collection_manual_adjustments
  for update
  using (
    public.has_permission('dashboard.adjust')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    public.has_permission('dashboard.adjust')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

drop policy if exists "adjustments_delete" on public.collection_manual_adjustments;
create policy "adjustments_delete" on public.collection_manual_adjustments
  for delete using (
    public.has_permission('dashboard.adjust')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );
-- =========================================================
-- Mi Perfil: foto de perfil (avatar) por usuario.
-- Cambiar nombre y contraseña ya funcionan con las políticas existentes de
-- profiles/auth (cada usuario puede actualizar su propia fila).
-- =========================================================

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Cada usuario solo puede escribir dentro de su propia carpeta
-- ({user_id}/archivo), identificada por el primer segmento de la ruta.
drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
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
-- =========================================================
-- Vistas por cliente: Consolidado (cruce diario Conciliacion +
-- Recoleccion reprogramada) y Paz y Salvos (estado mensual por CEDI +
-- documento firmado adjunto). Reutilizable para cualquier cliente activo,
-- no exclusivo de Colsubsidio.
--
-- Definiciones acordadas con el usuario:
-- - "Reprogramado" = collections.no_conciliado con
--   current_date - service_date >= 2 (mas de 1 dia sin conciliar).
-- - "Sin novedad" = reconciliations.novedad is null; "con novedad" = not null.
-- - "Paz y salvo" = suma de collections.no_conciliado del mes = 0 para ese
--   cedi; si no, "debe" esa suma (Compromiso de Pago).
-- =========================================================

-- ---------- Consolidado: por fecha de conciliacion, ciudad y cedi ----------
create or replace function public.consolidado_resumen(
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
  total_count bigint,
  total_amount numeric,
  sin_novedad_count bigint,
  sin_novedad_amount numeric,
  con_novedad_count bigint,
  con_novedad_amount numeric,
  reprogramada_count bigint,
  reprogramada_amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select r.reconciliation_date, r.city_id, r.cedi_code, r.cedi_name, r.novedad, r.collection_amount
    from public.reconciliations r
    where r.deleted_at is null
      and r.client_id = p_client_id
      and r.cedi_code is not null
      and r.reconciliation_date between p_date_from and p_date_to
      and (p_city_id is null or r.city_id = p_city_id)
  ),
  grouped as (
    select
      reconciliation_date, city_id, cedi_code, cedi_name,
      count(*) as total_count,
      coalesce(sum(collection_amount), 0) as total_amount,
      count(*) filter (where novedad is null) as sin_novedad_count,
      coalesce(sum(collection_amount) filter (where novedad is null), 0) as sin_novedad_amount,
      count(*) filter (where novedad is not null) as con_novedad_count,
      coalesce(sum(collection_amount) filter (where novedad is not null), 0) as con_novedad_amount
    from base
    group by reconciliation_date, city_id, cedi_code, cedi_name
  ),
  reprogramadas as (
    select
      c.service_date as reconciliation_date, c.city_id, c.cedi_code,
      count(*) as reprogramada_count,
      coalesce(sum(c.collection_amount), 0) as reprogramada_amount
    from public.collections c
    where c.deleted_at is null
      and c.client_id = p_client_id
      and c.cedi_code is not null
      and c.reconciliation_status = 'no_conciliado'
      and (current_date - c.service_date) >= 2
      and c.service_date between p_date_from and p_date_to
      and (p_city_id is null or c.city_id = p_city_id)
    group by c.service_date, c.city_id, c.cedi_code
  )
  select
    g.reconciliation_date, g.city_id, g.cedi_code, g.cedi_name,
    g.total_count, g.total_amount,
    g.sin_novedad_count, g.sin_novedad_amount,
    g.con_novedad_count, g.con_novedad_amount,
    coalesce(rp.reprogramada_count, 0) as reprogramada_count,
    coalesce(rp.reprogramada_amount, 0) as reprogramada_amount
  from grouped g
  left join reprogramadas rp
    on rp.reconciliation_date = g.reconciliation_date
    and rp.city_id = g.city_id
    and rp.cedi_code = g.cedi_code;
$$;

-- ---------- Paz y Salvos: por mes, ciudad y cedi ----------
create or replace function public.paz_salvo_resumen(
  p_client_id uuid,
  p_month_from date,
  p_month_to date,
  p_city_id uuid default null
)
returns table (
  period date,
  city_id uuid,
  cedi_code text,
  cedi_name text,
  total_amount numeric,
  pending_count bigint,
  pending_amount numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', c.service_date)::date as period,
    c.city_id,
    c.cedi_code,
    max(c.cedi_name) as cedi_name,
    coalesce(sum(c.collection_amount), 0) as total_amount,
    count(*) filter (where c.reconciliation_status = 'no_conciliado') as pending_count,
    coalesce(sum(c.collection_amount) filter (where c.reconciliation_status = 'no_conciliado'), 0) as pending_amount
  from public.collections c
  where c.deleted_at is null
    and c.client_id = p_client_id
    and c.cedi_code is not null
    and date_trunc('month', c.service_date)::date between p_month_from and p_month_to
    and (p_city_id is null or c.city_id = p_city_id)
  group by date_trunc('month', c.service_date)::date, c.city_id, c.cedi_code;
$$;

-- ---------- Documentos de Paz y Salvo (solo rastrea el firmado adjunto) ----------
create table public.paz_salvo_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  city_id uuid not null references public.cities(id),
  cedi_code text not null,
  cedi_name text,
  period date not null,
  document_type text not null check (document_type in ('paz_y_salvo', 'compromiso')),
  storage_path text not null,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id),
  deleted_at timestamptz
);
create unique index uq_paz_salvo_documents_period
  on public.paz_salvo_documents (client_id, cedi_code, period) where deleted_at is null;
create index idx_paz_salvo_documents_city on public.paz_salvo_documents (city_id);

alter table public.paz_salvo_documents enable row level security;

create policy "paz_salvo_documents_select" on public.paz_salvo_documents
  for select using (
    public.has_permission('conciliacion.view')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

create policy "paz_salvo_documents_insert" on public.paz_salvo_documents
  for insert with check (
    public.has_permission('conciliacion.edit')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

create policy "paz_salvo_documents_update" on public.paz_salvo_documents
  for update
  using (
    public.has_permission('conciliacion.edit')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  )
  with check (
    public.has_permission('conciliacion.edit')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

create policy "paz_salvo_documents_delete" on public.paz_salvo_documents
  for delete using (
    public.has_permission('conciliacion.edit')
    and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  );

-- ---------- Storage: PDFs de Paz y Salvo firmados ----------
insert into storage.buckets (id, name, public)
values ('paz-salvo', 'paz-salvo', false)
on conflict (id) do nothing;

create policy "paz_salvo_files_select" on storage.objects
  for select using (bucket_id = 'paz-salvo' and public.has_permission('conciliacion.view'));

create policy "paz_salvo_files_insert" on storage.objects
  for insert with check (bucket_id = 'paz-salvo' and public.has_permission('conciliacion.edit'));

create policy "paz_salvo_files_delete" on storage.objects
  for delete using (bucket_id = 'paz-salvo' and public.has_permission('conciliacion.edit'));
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
-- =========================================================
-- Fix: Total recolectado / Total conciliado / Reprogramadas / Total
-- pendientes no cuadraban entre si (ej. recolectado=25, conciliado=25,
-- pero reprogramadas=25 y pendientes=25 tambien). La causa: "conciliado"
-- salia de reconciliations agrupado por reconciliation_date, mientras que
-- "pendientes"/"reprogramadas" salian de collections agrupado por
-- service_date — dos fechas distintas que coincidian de casualidad, no
-- el mismo conjunto de ordenes.
--
-- Ahora las 4 metricas salen TODAS de collections, agrupadas por
-- service_date, particionando por su propio reconciliation_status. Esto
-- garantiza la identidad: recolectado = conciliado + pendiente, y
-- reprogramada siempre es un subconjunto de pendiente.
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
  select
    c.service_date as reconciliation_date,
    c.city_id,
    c.cedi_code,
    max(c.cedi_name) as cedi_name,
    count(*) as recoleccion_count,
    coalesce(sum(c.collection_amount), 0) as recoleccion_amount,
    count(*) filter (where c.reconciliation_status = 'conciliado') as conciliado_count,
    coalesce(sum(c.collection_amount) filter (where c.reconciliation_status = 'conciliado'), 0) as conciliado_amount,
    count(*) filter (
      where c.reconciliation_status = 'no_conciliado' and (current_date - c.service_date) >= 2
    ) as reprogramada_count,
    coalesce(sum(c.collection_amount) filter (
      where c.reconciliation_status = 'no_conciliado' and (current_date - c.service_date) >= 2
    ), 0) as reprogramada_amount,
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
-- =========================================================
-- Paz y Salvos: la vista se maneja por cantidad de ordenes, no por
-- dinero (igual que el Estado Abierto/Cerrado de Consolidado). Se
-- cambia total_amount/pending_amount por total_count/pending_count.
-- =========================================================
drop function if exists public.paz_salvo_resumen(uuid, date, date, uuid);

create function public.paz_salvo_resumen(
  p_client_id uuid,
  p_month_from date,
  p_month_to date,
  p_city_id uuid default null
)
returns table (
  period date,
  city_id uuid,
  cedi_code text,
  cedi_name text,
  total_count bigint,
  pending_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    date_trunc('month', c.service_date)::date as period,
    c.city_id,
    c.cedi_code,
    max(c.cedi_name) as cedi_name,
    count(*) as total_count,
    count(*) filter (where c.reconciliation_status = 'no_conciliado') as pending_count
  from public.collections c
  where c.deleted_at is null
    and c.client_id = p_client_id
    and c.cedi_code is not null
    and date_trunc('month', c.service_date)::date between p_month_from and p_month_to
    and (p_city_id is null or c.city_id = p_city_id)
  group by date_trunc('month', c.service_date)::date, c.city_id, c.cedi_code;
$$;
-- =========================================================
-- Conciliación: filtro por Nodo (CEDI), agregado como parámetro adicional
-- con default null — no cambia el tipo de retorno, así que CREATE OR REPLACE
-- basta (sin necesidad de drop).
-- =========================================================
create or replace function public.reconciliations_totals(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null,
  p_cedi_code text default null
)
returns table (total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint, coalesce(sum(collection_amount), 0)::numeric
  from public.reconciliations r
  where r.deleted_at is null
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_match_status is null or r.match_status = p_match_status)
    and (p_cedi_code is null or r.cedi_code = p_cedi_code)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_reconciliation_date_from is null or r.reconciliation_date >= p_reconciliation_date_from)
    and (p_reconciliation_date_to is null or r.reconciliation_date <= p_reconciliation_date_to)
    and (
      p_search is null or p_search = '' or
      r.service_number ilike '%' || p_search || '%' or
      r.client_name ilike '%' || p_search || '%' or
      r.client_document ilike '%' || p_search || '%' or
      r.cedi_name ilike '%' || p_search || '%'
    );
$$;

create or replace function public.reconciliations_matching_ids(
  p_search text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_reconciliation_date_from date default null,
  p_reconciliation_date_to date default null,
  p_client_id uuid default null,
  p_city_id uuid default null,
  p_match_status text default null,
  p_cedi_code text default null
)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select r.id
  from public.reconciliations r
  where r.deleted_at is null
    and (p_client_id is null or r.client_id = p_client_id)
    and (p_city_id is null or r.city_id = p_city_id)
    and (p_match_status is null or r.match_status = p_match_status)
    and (p_cedi_code is null or r.cedi_code = p_cedi_code)
    and (p_date_from is null or r.service_date >= p_date_from)
    and (p_date_to is null or r.service_date <= p_date_to)
    and (p_reconciliation_date_from is null or r.reconciliation_date >= p_reconciliation_date_from)
    and (p_reconciliation_date_to is null or r.reconciliation_date <= p_reconciliation_date_to)
    and (
      p_search is null or p_search = '' or
      r.service_number ilike '%' || p_search || '%' or
      r.client_name ilike '%' || p_search || '%' or
      r.client_document ilike '%' || p_search || '%' or
      r.cedi_name ilike '%' || p_search || '%'
    );
$$;
