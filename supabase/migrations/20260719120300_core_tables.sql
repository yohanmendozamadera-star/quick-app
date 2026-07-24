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
