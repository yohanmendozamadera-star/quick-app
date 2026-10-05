create function public.recaudos_detalle(p_client_id uuid, p_date date, p_city_id uuid, p_cedi_name text)
returns jsonb language sql stable security invoker set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'service_number',r.service_number,'client_name',r.client_name,'client_document',r.client_document,
 'service_date',r.service_date,'reconciliation_date',r.reconciliation_date,
 'collection_amount',r.collection_amount,'service_address',r.service_address,
 'cedi_name',coalesce(trim(r.cedi_name),''),'city_name',coalesce(c.name,'Sin ciudad')
 ) order by r.service_number,r.id),'[]'::jsonb)
 from public.reconciliations r left join public.cities c on c.id=r.city_id
 where r.deleted_at is null and r.client_id=p_client_id
 and r.reconciliation_date=p_date and r.city_id is not distinct from p_city_id
 and coalesce(trim(r.cedi_name),'')=p_cedi_name
 and (r.novedad is null or trim(lower(r.novedad)) in ('','sin novedad'))
 and public.has_permission('conciliacion.view') and public.has_permission('conciliacion.export');
$$;
revoke all on function public.recaudos_detalle(uuid,date,uuid,text) from public,anon;
grant execute on function public.recaudos_detalle(uuid,date,uuid,text) to authenticated;
