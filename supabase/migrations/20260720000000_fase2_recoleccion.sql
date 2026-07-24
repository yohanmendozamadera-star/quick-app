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
