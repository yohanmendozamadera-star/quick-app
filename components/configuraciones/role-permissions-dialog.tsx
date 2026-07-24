"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { setRolePermissions } from "@/app/(app)/configuraciones/users-actions";
import type { PermissionRow, RoleRow } from "@/lib/users/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ACTION_LABELS: Record<string, string> = {
  view: "Ver",
  create: "Crear",
  edit: "Editar",
  delete: "Eliminar",
  import: "Importar",
  export: "Exportar",
  manage: "Administrar",
  adjust: "Ajustar",
  revert: "Revertir",
};

function actionLabel(code: string) {
  const action = code.split(".")[1] ?? code;
  return ACTION_LABELS[action] ?? action;
}

function moduleLabel(module: string) {
  return module
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RolePermissionsDialog({
  role,
  permissions,
  grantedIds,
}: {
  role: RoleRow;
  permissions: PermissionRow[];
  grantedIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(grantedIds));
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) setSelected(new Set(grantedIds));
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const grouped = permissions.reduce<Record<string, PermissionRow[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  const handleSave = async () => {
    setSubmitting(true);
    const result = await setRolePermissions(role.id, Array.from(selected));
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }
    toast.success("Permisos actualizados");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <ShieldCheck className="size-3.5" />
        Permisos ({grantedIds.length})
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permisos de {role.name}</DialogTitle>
          <DialogDescription>
            Marca lo que este rol puede hacer en cada módulo. Los cambios aplican de inmediato a todos los
            usuarios con este rol.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {Object.entries(grouped).map(([module, perms]) => (
            <div key={module} className="space-y-1.5 rounded-md border p-3">
              <p className="text-sm font-medium">{moduleLabel(module)}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {perms.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                    {actionLabel(p.code)}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitting} onClick={handleSave}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Guardar permisos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
