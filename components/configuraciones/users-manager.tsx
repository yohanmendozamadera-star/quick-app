"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateUserRole, setUserActive } from "@/app/(app)/configuraciones/users-actions";
import type { ProfileRow, RoleRow } from "@/lib/users/queries";
import type { CatalogOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCreateDialog } from "@/components/configuraciones/user-create-dialog";
import { ResetPasswordDialog } from "@/components/configuraciones/reset-password-dialog";
import { UserCitiesDialog } from "@/components/configuraciones/user-cities-dialog";

export function UsersManager({
  profiles,
  roles,
  cities,
  profileCityMap,
}: {
  profiles: ProfileRow[];
  roles: RoleRow[];
  cities: CatalogOption[];
  profileCityMap: Record<string, string[]>;
}) {
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const term = search.trim().toLocaleLowerCase("es-CO");
  const visible = profiles.filter(
    (p) =>
      !term ||
      p.full_name.toLocaleLowerCase("es-CO").includes(term) ||
      p.email.toLocaleLowerCase("es-CO").includes(term),
  );

  const handleRoleChange = async (userId: string, roleId: string) => {
    setSavingId(userId);
    const result = await updateUserRole(userId, roleId);
    setSavingId(null);

    if (!result.success) {
      toast.error("No se pudo cambiar el rol", { description: result.message });
      return;
    }
    toast.success("Rol actualizado");
  };

  const handleToggleActive = async (profile: ProfileRow) => {
    setSavingId(profile.id);
    const result = await setUserActive(profile.id, !profile.is_active);
    setSavingId(null);

    if (!result.success) {
      toast.error("No se pudo actualizar", { description: result.message });
      return;
    }
    toast.success(profile.is_active ? "Usuario desactivado" : "Usuario activado");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="ml-auto">
          <UserCreateDialog roles={roles} cities={cities} />
        </div>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2.5">Nombre</th>
                <th className="px-3 py-2.5">Correo</th>
                <th className="px-3 py-2.5">Rol</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Sin usuarios todavía.
                  </td>
                </tr>
              )}
              {visible.map((profile) => (
                <tr key={profile.id} className={profile.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-medium">{profile.full_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{profile.email}</td>
                  <td className="px-3 py-2">
                    <select
                      className="h-8 rounded-md border bg-transparent px-2 text-sm"
                      value={profile.role_id}
                      disabled={savingId === profile.id}
                      onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">{profile.is_active ? "Activo" : "Inactivo"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <UserCitiesDialog
                        userId={profile.id}
                        userLabel={`${profile.full_name} · ${profile.email}`}
                        cities={cities}
                        assignedCityIds={profileCityMap[profile.id] ?? []}
                      />
                      <ResetPasswordDialog userId={profile.id} userLabel={`${profile.full_name} · ${profile.email}`} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingId === profile.id}
                        onClick={() => handleToggleActive(profile)}
                      >
                        {profile.is_active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
