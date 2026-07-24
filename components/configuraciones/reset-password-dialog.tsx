"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { resetUserPassword } from "@/app/(app)/configuraciones/users-actions";
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

export function ResetPasswordDialog({ userId, userLabel }: { userId: string; userLabel: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) setPassword("");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await resetUserPassword(userId, password);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo cambiar la contraseña", { description: result.message });
      return;
    }
    toast.success("Contraseña actualizada");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Cambiar contraseña" />}>
        <KeyRound className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>{userLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="new_password">Nueva contraseña *</Label>
          <Input id="new_password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>

        <DialogFooter>
          <Button type="button" disabled={submitting || password.length < 8} onClick={handleSubmit}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
