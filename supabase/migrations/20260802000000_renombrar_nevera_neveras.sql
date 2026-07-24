-- =========================================================
-- El tipo de carga se llama "Neveras" (plural), no "Nevera". Se renombra el
-- registro existente (no se borra e inserta de nuevo) para no perder el id
-- que ya usan las recolecciones/conciliaciones cargadas.
-- =========================================================
update public.load_types set name = 'Neveras' where lower(name) = 'nevera';
