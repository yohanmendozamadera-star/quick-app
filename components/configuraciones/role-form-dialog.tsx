"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { createRole, updateRole } from "@/app/(app)/configuraciones/users-actions";
import type { RoleRow } from "@/lib/users/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RoleFormDialog({ role }: { role?: RoleRow }) {
  const isEdit = Boolean(role);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = isEdit ? await updateRole(role!.id, name, description) : await createRole(name, description);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }
    toast.success(isEdit ? "Rol actualizado" : "Rol creado");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar rol" />
          ) : (
            <Button className="gap-1.5" />
          )
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" />
            Crear rol
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El rol nace sin permisos asignados; configúralos desde el botón Permisos."
              : "El rol nace sin permisos asignados; configúralos después desde el botón Permisos."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="role_name">Nombre *</Label>
            <Input id="role_name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role_description">Descripción</Label>
            <Input id="role_description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={submitting || !name.trim()} onClick={handleSubmit}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear rol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
