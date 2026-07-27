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
