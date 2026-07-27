-- =========================================================
-- Paz y Salvos: la vista se maneja por cantidad de ordenes, no por
-- dinero (igual que el Estado Abierto/Cerrado de Consolidado). Se
-- cambia total_amount/pending_amount por total_count/pending_count.
-- =========================================================
drop function if exists public.paz_salvo_resumen(uuid, date, date, uuid);

create function public.paz_salvo_resumen(
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
  total_count bigint,
  pending_count bigint
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
    count(*) as total_count,
    count(*) filter (where c.reconciliation_status = 'no_conciliado') as pending_count
  from public.collections c
  where c.deleted_at is null
    and c.client_id = p_client_id
    and c.cedi_code is not null
    and date_trunc('month', c.service_date)::date between p_month_from and p_month_to
    and (p_city_id is null or c.city_id = p_city_id)
  group by date_trunc('month', c.service_date)::date, c.city_id, c.cedi_code;
$$;
