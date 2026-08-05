-- =========================================================
-- Recolección: nueva "Fecha de recolección" (aplica a todo el lote en la
-- carga masiva, igual que Cliente/Ciudad), independiente de la Fecha del
-- servicio que ya se pega por fila. Se usa en el Acta del Nodo para mostrar
-- cuándo se recogió cada orden.
-- =========================================================
alter table public.collections add column collection_date date;
