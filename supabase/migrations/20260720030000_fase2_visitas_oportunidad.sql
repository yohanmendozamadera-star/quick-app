-- =========================================================
-- Fase 2 - Visitas (guias repetidas) y Oportunidad (dias sin conciliar)
-- =========================================================

-- Cuenta cuantas veces se ha cargado la misma guia (numero de servicio) para
-- un cliente. Nace en 1; la carga masiva la incrementa cuando encuentra una
-- guia que ya existia, en vez de crear una fila repetida.
alter table public.collections add column if not exists visits integer not null default 1;

-- Incremento atomico de "visits" para las guias que ya existian al momento
-- de una carga masiva (evita condiciones de carrera entre cargas simultaneas).
create or replace function public.increment_collection_visits(
  p_client_id uuid,
  p_service_numbers text[]
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.collections
  set visits = visits + 1
  where client_id = p_client_id
    and service_number = any(p_service_numbers)
    and deleted_at is null;
$$;
