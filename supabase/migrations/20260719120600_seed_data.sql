-- =========================================================
-- Datos iniciales
-- =========================================================

-- ---------- Roles ----------
insert into public.roles (name, description) values
  ('Administrador', 'Acceso total: visualizar, crear, editar, eliminar, importar, exportar y administrar usuarios'),
  ('Coordinador', 'Visualizar, crear, editar, importar, exportar y realizar cambios masivos'),
  ('Operador', 'Visualizar, crear, importar y editar registros permitidos'),
  ('Consulta', 'Solamente visualizar y descargar informacion')
on conflict (name) do nothing;

-- ---------- Permisos por modulo (view/create/edit/delete/import/export) ----------
insert into public.permissions (code, module, description)
select m.module || '.' || a.action, m.module, initcap(a.action) || ' - ' || m.module
from unnest(array['recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades']) as m(module)
cross join unnest(array['view', 'create', 'edit', 'delete', 'import', 'export']) as a(action)
on conflict (code) do nothing;

insert into public.permissions (code, module, description) values
  ('dashboard.view', 'dashboard', 'Ver dashboard'),
  ('dashboard.adjust', 'dashboard', 'Agregar ajuste manual en el dashboard'),
  ('config.manage', 'config', 'Administrar catalogos de configuracion'),
  ('users.manage', 'users', 'Administrar usuarios y roles'),
  ('audit.view', 'audit', 'Ver auditoria')
on conflict (code) do nothing;

-- ---------- Administrador: todos los permisos ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Administrador'
on conflict do nothing;

-- ---------- Coordinador: view/create/edit/import/export + dashboard ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Coordinador'
  and (
    (p.module in ('recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades')
     and split_part(p.code, '.', 2) in ('view', 'create', 'edit', 'import', 'export'))
    or p.code in ('dashboard.view', 'dashboard.adjust')
  )
on conflict do nothing;

-- ---------- Operador: view/create/import/edit + dashboard.view ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Operador'
  and (
    (p.module in ('recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades')
     and split_part(p.code, '.', 2) in ('view', 'create', 'import', 'edit'))
    or p.code = 'dashboard.view'
  )
on conflict do nothing;

-- ---------- Consulta: view/export + dashboard.view ----------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'Consulta'
  and (
    (p.module in ('recoleccion', 'conciliacion', 'tipo_servicio', 'adicionales', 'disponibilidades')
     and split_part(p.code, '.', 2) in ('view', 'export'))
    or p.code = 'dashboard.view'
  )
on conflict do nothing;

-- ---------- Clientes iniciales ----------
insert into public.clients (name) values ('Colsubsidio'), ('Plintron')
on conflict do nothing;

-- ---------- Ciudades iniciales ----------
insert into public.cities (name) values ('Barranquilla'), ('Ibagué'), ('Armenia'), ('Cali')
on conflict do nothing;

-- ---------- Tipos de carga iniciales ----------
insert into public.load_types (name) values ('Nevera'), ('Periferia'), ('Volumen')
on conflict do nothing;

-- ---------- Tipos de servicio (Adicionales) ----------
insert into public.service_types (scope, name) values
  ('adicionales', 'Cross Docking'),
  ('adicionales', 'Institucional'),
  ('adicionales', 'Comercial')
on conflict do nothing;

-- ---------- Tipos de transporte ----------
insert into public.transport_types (name) values ('Carry'), ('Moto')
on conflict do nothing;

-- ---------- Descripciones de cobro ----------
insert into public.charge_descriptions (name) values
  ('Adicional'), ('Adicional + Periferia'), ('Hora extra'),
  ('Personal de planta'), ('Periferia'), ('Vuelta')
on conflict do nothing;

-- ---------- Estados (catalogo de presentacion) ----------
insert into public.statuses (module, code, label, color) values
  ('conciliacion', 'no_conciliado', 'No conciliado', 'gray'),
  ('conciliacion', 'conciliado', 'Conciliado', 'green'),
  ('tipo_servicio', 'no_facturado', 'No facturado', 'gray'),
  ('tipo_servicio', 'facturado', 'Facturado', 'blue'),
  ('adicionales', 'pendiente', 'Pendiente', 'gray'),
  ('adicionales', 'reportado', 'Reportado', 'yellow'),
  ('adicionales', 'aprobado', 'Aprobado', 'green'),
  ('adicionales', 'rechazado', 'Rechazado', 'red'),
  ('adicionales', 'facturado', 'Facturado', 'blue'),
  ('disponibilidades', 'pendiente', 'Pendiente', 'gray'),
  ('disponibilidades', 'confirmada', 'Confirmada', 'green'),
  ('disponibilidades', 'cancelada', 'Cancelada', 'red')
on conflict do nothing;
