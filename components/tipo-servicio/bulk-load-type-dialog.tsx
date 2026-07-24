"use client";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { bulkSetLoadType } from "@/app/(app)/tipo-servicio/actions";
import type { CatalogOption } from "@/lib/catalog/queries";
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

export function BulkLoadTypeDialog({
  trigger,
  ids,
  loadTypes,
  onDone,
}: {
  trigger: ReactElement;
  ids: string[];
  loadTypes: CatalogOption[];
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loadTypeId, setLoadTypeId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) setLoadTypeId("");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    const result = await bulkSetLoadType(ids, loadTypeId);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo cambiar el tipo de servicio", { description: result.message });
      return;
    }

    toast.success(`Tipo de servicio actualizado en ${result.affected} registro${result.affected === 1 ? "" : "s"}`, {
      description:
        result.affected < ids.length
          ? "Los registros Verificados no se modifican."
          : undefined,
    });
    setOpen(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar tipo de servicio</DialogTitle>
          <DialogDescription>
            Se aplicará a {ids.length} registro{ids.length === 1 ? "" : "s"} seleccionado
            {ids.length === 1 ? "" : "s"}. Los registros Verificados no se modifican.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="bulk_load_type">Nuevo tipo de servicio</Label>
          <select
            id="bulk_load_type"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            value={loadTypeId}
            onChange={(e) => setLoadTypeId(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {loadTypes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" disabled={!loadTypeId || submitting} onClick={handleConfirm}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
