"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setBillingStatus } from "@/app/(app)/tipo-servicio/actions";
import type { BillingStatus } from "@/lib/service-types/types";
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
  defaultTarget = "verificado",
  canRevert,
  onDone,
}: {
  trigger: ReactElement;
  ids: string[];
  defaultTarget?: BillingStatus;
  canRevert: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<BillingStatus>(defaultTarget);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      setTarget(defaultTarget);
      setReason("");
    }
  };

  const isRevert = target === "no_verificado";
  const canConfirm = !isRevert || (canRevert && reason.trim().length > 0);

  const handleConfirm = async () => {
    setSubmitting(true);
    const result = await setBillingStatus(ids, target, isRevert ? reason.trim() : undefined);
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant={target === "verificado" ? "default" : "outline"}
              size="sm"
              onClick={() => setTarget("verificado")}
            >
              Verificado
            </Button>
            <Button
              type="button"
              variant={target === "no_verificado" ? "default" : "outline"}
              size="sm"
              disabled={!canRevert}
              onClick={() => setTarget("no_verificado")}
              title={!canRevert ? "Solo un Administrador puede revertir a No verificado" : undefined}
            >
              No verificado (revertir)
            </Button>
          </div>

          {isRevert && (
            <div className="space-y-1.5">
              <Label htmlFor="reverted_reason">Motivo de la reversión *</Label>
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
