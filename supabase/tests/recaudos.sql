begin;
do $test$
declare
  v_user uuid;
  v_client uuid;
  v_city uuid;
  v_city_other uuid;
  v_name text := 'TEST-RECAUDOS-' || gen_random_uuid()::text;
  v_rows jsonb;
  v_amount numeric;
begin
  select p.id into v_user from public.profiles p
    join public.role_permissions rp on rp.role_id=p.role_id
    join public.permissions perm on perm.id=rp.permission_id
    where p.is_active and perm.code='conciliacion.view' limit 1;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  select client_id,city_id into v_client,v_city from public.reconciliations
    where deleted_at is null and client_id is not null and city_id is not null limit 1;
  select id into v_city_other from public.cities where id <> v_city limit 1;
  insert into public.reconciliations
    (service_number,client_id,city_id,cedi_name,service_date,reconciliation_date,collection_amount,novedad)
  values
    (gen_random_uuid()::text,v_client,v_city,v_name,'1900-01-01','1901-01-02',100,null),
    (gen_random_uuid()::text,v_client,v_city,v_name,'1900-01-01','1901-01-02',200,''),
    (gen_random_uuid()::text,v_client,v_city,v_name,'1900-01-01','1901-01-02',300,' Sin Novedad '),
    (gen_random_uuid()::text,v_client,v_city,v_name,'1900-01-01','1901-01-02',999,'No entregado'),
    (gen_random_uuid()::text,v_client,v_city,v_name,'1900-01-01','1901-01-03',50,null),
    (gen_random_uuid()::text,v_client,v_city_other,v_name,'1900-01-01','1901-01-02',75,null);
  insert into public.recaudo_documents
    (client_id,city_id,reconciliation_date,cedi_name,storage_path,file_name,uploaded_by)
  values(v_client,v_city,'1901-01-02',v_name,
    v_client::text || '/' || v_city::text || '/1901-01-02/' || gen_random_uuid()::text || '.jpg',
    'test.jpg',v_user);
  v_rows := public.recaudos_resumen(v_client,'1901-01-02','1901-01-03');
  select (r->>'amount')::numeric into v_amount from jsonb_array_elements(v_rows) r
    where r->>'cediName'=v_name and r->>'cityId'=v_city::text and r->>'date'='1901-01-02';
  if v_amount is distinct from 600 then raise exception 'Sin novedad sum failed: %',v_amount; end if;
  if not exists(select 1 from jsonb_array_elements(v_rows) r where r->>'cediName'=v_name
    and r->>'cityId'=v_city::text and r->>'date'='1901-01-02' and r->'document' <> 'null'::jsonb) then
    raise exception 'Photo association failed'; end if;
  if exists(select 1 from jsonb_array_elements(v_rows) r where r->>'cediName'=v_name
    and (r->>'cityId' <> v_city::text or r->>'date'<>'1901-01-02') and r->'document' <> 'null'::jsonb) then
    raise exception 'Photo leaked across city/date'; end if;
  v_rows := public.recaudos_resumen(v_client,'1901-01-02','1901-01-03',v_city);
  if exists(select 1 from jsonb_array_elements(v_rows) r where r->>'cityId'<>v_city::text) then
    raise exception 'City filter failed'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  if public.recaudos_resumen(v_client,'1901-01-02','1901-01-03') <> '[]'::jsonb then
    raise exception 'Unauthenticated summary access'; end if;
end;
$test$;
rollback;
