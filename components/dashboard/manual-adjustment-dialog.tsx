"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  manualAdjustmentFormSchema,
  type ManualAdjustmentFormValues,
} from "@/lib/validations/manual-adjustment";
import { createManualAdjustment } from "@/app/(app)/dashboard/actions";
import type { CatalogOption } from "@/lib/catalog/queries";
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

export function ManualAdjustmentDialog({
  clients,
  cities,
}: {
  clients: CatalogOption[];
  cities: CatalogOption[];
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualAdjustmentFormValues>({
    resolver: zodResolver(manualAdjustmentFormSchema),
    defaultValues: {
      adjustment_date: "",
      client_id: "",
      city_id: "",
      quantity: 0,
      reason: "",
      observation: "",
    },
  });

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      reset({ adjustment_date: "", client_id: "", city_id: "", quantity: 0, reason: "", observation: "" });
    }
  };

  const onSubmit = async (values: ManualAdjustmentFormValues) => {
    setSubmitting(true);
    const result = await createManualAdjustment(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success("Ajuste manual agregado");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" />
        Agregar registro manual
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo ajuste manual</DialogTitle>
          <DialogDescription>
            Este ajuste se suma al total automático de Recolección, pero queda identificado por
            separado para mantener la trazabilidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="adjustment_date">Fecha *</Label>
            <Input id="adjustment_date" type="date" {...register("adjustment_date")} />
            {errors.adjustment_date && (
              <p className="text-sm text-destructive">{errors.adjustment_date.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client_id">Cliente *</Label>
            <select
              id="client_id"
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              {...register("client_id")}
            >
              <option value="">Selecciona…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.client_id && <p className="text-sm text-destructive">{errors.client_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city_id">Ciudad *</Label>
            <select
              id="city_id"
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              {...register("city_id")}
            >
              <option value="">Selecciona…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.city_id && <p className="text-sm text-destructive">{errors.city_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">Cantidad *</Label>
            <Input id="quantity" type="number" step="1" {...register("quantity")} />
            <p className="text-xs text-muted-foreground">
              Usa un número negativo para restar del total (por ejemplo, para corregir un exceso).
            </p>
            {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Motivo del ajuste *</Label>
            <Input id="reason" {...register("reason")} />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observation">Observación</Label>
            <Input id="observation" {...register("observation")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Guardar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
