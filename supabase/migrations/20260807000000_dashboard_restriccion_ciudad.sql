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
