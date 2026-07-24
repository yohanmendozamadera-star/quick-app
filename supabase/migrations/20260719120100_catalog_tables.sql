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
