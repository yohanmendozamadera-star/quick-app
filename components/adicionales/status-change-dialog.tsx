"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setAdditionalServiceStatus } from "@/app/(app)/adicionales/actions";
import { STATUS_OPTIONS, type AdditionalServiceStatus } from "@/lib/additional-services/types";
import { Button } from "@/components/ui/button";
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

export function StatusChangeDialog({
  trigger,
  ids,
  currentStatus,
  canRevert,
  onDone,
}: {
  trigger: ReactElement;
  ids: string[];
  currentStatus?: AdditionalServiceStatus;
  canRevert: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AdditionalServiceStatus>(currentStatus ?? "pendiente");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      setTarget(currentStatus ?? "pendiente");
      setReason("");
    }
  };

  // En modo individual (currentStatus conocido) se sabe con certeza si es una
  // reversión. En modo masivo no se sabe el estado de cada fila seleccionada
  // de antemano: se manda el motivo si el usuario lo escribió y que la
  // función de la base de datos decida si hace falta (y lo exija con un
  // error si algún seleccionado sí estaba Facturado).
  const isBulk = currentStatus === undefined;
  const isRevert = currentStatus === "facturado" && target !== "facturado";
  const canConfirm = isBulk
    ? true
    : target !== currentStatus && (!isRevert || (canRevert && reason.trim().length > 0));

  const handleConfirm = async () => {
    setSubmitting(true);
    const reasonToSend = isBulk ? reason.trim() || undefined : isRevert ? reason.trim() : undefined;
    const result = await setAdditionalServiceStatus(ids, target, reasonToSend);
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
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => {
              const wouldBeRevert = currentStatus === "facturado" && s.value !== "facturado";
              const disabled = wouldBeRevert && !canRevert;
              return (
                <Button
                  key={s.value}
                  type="button"
                  variant={target === s.value ? "default" : "outline"}
                  size="sm"
                  disabled={disabled}
                  onClick={() => setTarget(s.value)}
                  title={disabled ? "Solo un Administrador puede revertir un registro Facturado" : undefined}
                >
                  {s.label}
                </Button>
              );
            })}
          </div>

          {(isRevert || isBulk) && (
            <div className="space-y-1.5">
              <Label htmlFor="reverted_reason">
                Motivo de la reversión {isBulk ? "(obligatorio si alguno está Facturado)" : "*"}
              </Label>
              <textarea
                id="reverted_reason"
                rows={3}
                className="w-full rounded-md border bg-transparent p-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
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
