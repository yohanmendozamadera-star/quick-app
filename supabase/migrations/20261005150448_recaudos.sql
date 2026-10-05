-- Recaudos: summaries use reconciliation date and only "Sin novedad".
create table public.recaudo_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  city_id uuid not null references public.cities(id),
  reconciliation_date date not null,
  cedi_name text not null check (length(trim(cedi_name)) > 0),
  storage_path text not null unique,
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references auth.users(id),
  unique (client_id, city_id, reconciliation_date, cedi_name)
);
alter table public.recaudo_documents enable row level security;
grant select, insert, update on public.recaudo_documents to authenticated;
create policy recaudo_documents_select on public.recaudo_documents for select to authenticated
using (public.has_permission('conciliacion.view') and
  (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids())));
create policy recaudo_documents_insert on public.recaudo_documents for insert to authenticated
with check (public.has_permission('conciliacion.view') and public.has_permission('conciliacion.edit')
  and uploaded_by = auth.uid()
  and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  and split_part(storage_path, '/', 1) = client_id::text
  and split_part(storage_path, '/', 2) = city_id::text
  and split_part(storage_path, '/', 3) = reconciliation_date::text);
create policy recaudo_documents_update on public.recaudo_documents for update to authenticated
using (public.has_permission('conciliacion.view') and public.has_permission('conciliacion.edit')
  and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids())))
with check (public.has_permission('conciliacion.view') and public.has_permission('conciliacion.edit')
  and uploaded_by = auth.uid()
  and (not public.user_has_city_restriction() or city_id = any(public.current_user_city_ids()))
  and split_part(storage_path, '/', 1) = client_id::text
  and split_part(storage_path, '/', 2) = city_id::text
  and split_part(storage_path, '/', 3) = reconciliation_date::text);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('recaudos','recaudos',false,10485760,array['image/jpeg','image/png','image/webp']);

create policy recaudos_files_select on storage.objects for select to authenticated
using (bucket_id='recaudos' and public.has_permission('conciliacion.view')
  and (not public.user_has_city_restriction() or split_part(name,'/',2) = any(
    select x::text from unnest(public.current_user_city_ids()) x)));
create policy recaudos_files_insert on storage.objects for insert to authenticated
with check (bucket_id='recaudos' and public.has_permission('conciliacion.view')
  and public.has_permission('conciliacion.edit')
  and (not public.user_has_city_restriction() or split_part(name,'/',2) = any(
    select x::text from unnest(public.current_user_city_ids()) x)));
create policy recaudos_files_delete on storage.objects for delete to authenticated
using (bucket_id='recaudos' and public.has_permission('conciliacion.view')
  and public.has_permission('conciliacion.edit')
  and (not public.user_has_city_restriction() or split_part(name,'/',2) = any(
    select x::text from unnest(public.current_user_city_ids()) x)));

-- Return one JSON value so large summaries are not truncated by the Data API row limit.
create function public.recaudos_resumen(
  p_client_id uuid, p_date_from date, p_date_to date, p_city_id uuid default null
) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with totals as (
    select r.reconciliation_date, r.city_id, coalesce(trim(r.cedi_name),'') as cedi_name,
      count(*) as guide_count, coalesce(sum(r.collection_amount),0) as total_amount
    from public.reconciliations r
    where r.deleted_at is null and r.client_id=p_client_id
      and public.has_permission('conciliacion.view')
      and (r.novedad is null or trim(lower(r.novedad)) in ('','sin novedad'))
      and r.reconciliation_date between p_date_from and p_date_to
      and (p_city_id is null or r.city_id=p_city_id)
    group by r.reconciliation_date,r.city_id,coalesce(trim(r.cedi_name),'')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',t.reconciliation_date,'cityId',t.city_id,'cityName',coalesce(c.name,'Sin ciudad'),
    'cediName',t.cedi_name,'guideCount',t.guide_count,'amount',t.total_amount,
    'document',case when d.id is null then null else jsonb_build_object(
      'id',d.id,'fileName',d.file_name,'uploadedAt',d.uploaded_at) end
  ) order by t.reconciliation_date desc,c.name,t.cedi_name),'[]'::jsonb)
  from totals t
  left join public.cities c on c.id=t.city_id
  left join public.recaudo_documents d on d.client_id=p_client_id and d.city_id=t.city_id
    and d.reconciliation_date=t.reconciliation_date and d.cedi_name=t.cedi_name;
$$;
revoke all on function public.recaudos_resumen(uuid,date,date,uuid) from public,anon;
grant execute on function public.recaudos_resumen(uuid,date,date,uuid) to authenticated;
