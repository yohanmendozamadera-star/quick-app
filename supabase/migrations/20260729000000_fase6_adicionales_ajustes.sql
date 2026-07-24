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
