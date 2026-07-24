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
