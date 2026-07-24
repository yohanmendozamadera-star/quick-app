-- =========================================================
-- Recoleccion: nuevo campo "Conductor" (nombre del conductor asignado al
-- servicio), que si viene en la carga masiva real del usuario.
-- =========================================================
alter table public.collections add column if not exists driver_name text;
