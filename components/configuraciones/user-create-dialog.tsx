"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createUserAccount } from "@/app/(app)/configuraciones/users-actions";
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

export function UserCreateDialog({ roles }: { roles: RoleRow[] }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setRoleId("");
  };

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) reset();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await createUserAccount({ fullName, email, password, roleId });
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo crear el usuario", { description: result.message });
      return;
    }
    toast.success("Usuario creado");
    setOpen(false);
  };

  const canSubmit = fullName.trim() && email.trim() && password.length >= 8 && roleId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" />
        Crear usuario
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            El usuario queda activo de inmediato y puede iniciar sesión con este correo y contraseña.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="user_full_name">Nombre completo *</Label>
            <Input id="user_full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user_email">Correo *</Label>
            <Input id="user_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user_password">Contraseña *</Label>
            <Input
              id="user_password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Compártesela al usuario aparte.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user_role">Rol *</Label>
            <select
              id="user_role"
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={submitting || !canSubmit} onClick={handleSubmit}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
