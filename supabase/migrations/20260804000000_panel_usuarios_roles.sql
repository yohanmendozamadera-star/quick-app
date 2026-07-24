-- =========================================================
-- Panel de administracion de Usuarios y Roles (Configuraciones > Roles /
-- Usuarios). roles, permissions, role_permissions y profiles ya existian
-- desde la Fase 1; aqui solo se corrige el permiso que protege su
-- escritura: administrar roles/permisos es "users.manage" (tal como dice
-- la descripcion de ese permiso: "Administrar usuarios y roles"), no
-- "config.manage" (que quedo mal puesto porque roles/permissions viajaban
-- en el mismo loop generico que los catalogos de Recoleccion/Adicionales).
-- =========================================================

drop policy if exists "roles_manage" on public.roles;
create policy "roles_manage" on public.roles
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists "permissions_manage" on public.permissions;
create policy "permissions_manage" on public.permissions
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists "role_permissions_manage" on public.role_permissions;
create policy "role_permissions_manage" on public.role_permissions
  for all using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));
