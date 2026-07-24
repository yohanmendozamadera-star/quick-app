import type { PermissionRow, RoleRow } from "@/lib/users/queries";
import { RoleFormDialog } from "@/components/configuraciones/role-form-dialog";
import { RolePermissionsDialog } from "@/components/configuraciones/role-permissions-dialog";

export function RolesManager({
  roles,
  permissions,
  rolePermissionMap,
}: {
  roles: RoleRow[];
  permissions: PermissionRow[];
  rolePermissionMap: Record<string, string[]>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <RoleFormDialog />
      </div>

      <div className="rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2.5">Nombre</th>
              <th className="px-3 py-2.5">Descripción</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                  Sin roles todavía.
                </td>
              </tr>
            )}
            {roles.map((role) => (
              <tr key={role.id}>
                <td className="px-3 py-2 font-medium">{role.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{role.description ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <RoleFormDialog role={role} />
                    <RolePermissionsDialog
                      role={role}
                      permissions={permissions}
                      grantedIds={rolePermissionMap[role.id] ?? []}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
