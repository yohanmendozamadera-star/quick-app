"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setAvailabilityStatus } from "@/app/(app)/disponibilidades/actions";
import { STATUS_OPTIONS, type AvailabilityStatus } from "@/lib/availabilities/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Aprobar exige "approve" o "authorize" (Líder o Jefe). Autorizar y revertir
// a Registrado exigen "authorize" (solo Jefe).
function isEnabled(status: AvailabilityStatus, canApprove: boolean, canAuthorize: boolean) {
  if (status === "aprobado") return canApprove || canAuthorize;
  return canAuthorize;
}

export function StatusChangeDialog({
  trigger,
  ids,
  currentStatus,
  canApprove,
  canAuthorize,
  onDone,
}: {
  trigger: ReactElement;
  ids: string[];
  currentStatus?: AvailabilityStatus;
  canApprove: boolean;
  canAuthorize: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AvailabilityStatus>(currentStatus ?? "registrado");
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) setTarget(currentStatus ?? "registrado");
  };

  const canConfirm = target !== currentStatus && isEnabled(target, canApprove, canAuthorize);

  const handleConfirm = async () => {
    setSubmitting(true);
    const result = await setAvailabilityStatus(ids, target);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo cambiar el estado", { description: result.message });
      return;
    }

    toast.success(`Estado actualizado en ${result.affected} registro${result.affected === 1 ? "" : "s"}`);
    setOpen(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
          <DialogDescription>
            Se aplicará a {ids.length} registro{ids.length === 1 ? "" : "s"} seleccionado
            {ids.length === 1 ? "" : "s"}.
            {!canAuthorize && " Solo un Jefe puede autorizar o revertir a Registrado."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s.value}
              type="button"
              variant={target === s.value ? "default" : "outline"}
              size="sm"
              disabled={!isEnabled(s.value, canApprove, canAuthorize)}
              onClick={() => setTarget(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" disabled={!canConfirm || submitting} onClick={handleConfirm}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
