"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  reconciliationFormSchema,
  type ReconciliationFormValues,
} from "@/lib/validations/reconciliation";
import { createReconciliation, updateReconciliation } from "@/app/(app)/conciliacion/actions";
import type { ReconciliationRow } from "@/lib/reconciliations/types";
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

type Props = {
  clients: CatalogOption[];
  cities: CatalogOption[];
  loadTypes: CatalogOption[];
  reconciliation?: ReconciliationRow;
};

function toFormValues(reconciliation?: ReconciliationRow): ReconciliationFormValues {
  return {
    service_number: reconciliation?.service_number ?? "",
    client_id: reconciliation?.client_id ?? "",
    client_name: reconciliation?.client_name ?? "",
    novedad: reconciliation?.novedad ?? "",
    city_id: reconciliation?.city_id ?? "",
    cedi_code: reconciliation?.cedi_code ?? "",
    cedi_name: reconciliation?.cedi_name ?? "",
    service_address: reconciliation?.service_address ?? "",
    service_date: reconciliation?.service_date ?? "",
    load_type_id: reconciliation?.load_type_id ?? "",
    client_document: reconciliation?.client_document ?? "",
    collection_amount: reconciliation?.collection_amount ?? 0,
  };
}

export function ReconciliationFormDialog({ clients, cities, loadTypes, reconciliation }: Props) {
  const isEdit = Boolean(reconciliation);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReconciliationFormValues>({
    resolver: zodResolver(reconciliationFormSchema),
    defaultValues: toFormValues(reconciliation),
  });

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) reset(toFormValues(reconciliation));
  };

  const onSubmit = async (values: ReconciliationFormValues) => {
    setSubmitting(true);
    const result = isEdit
      ? await updateReconciliation(reconciliation!.id, values)
      : await createReconciliation(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    if (result.matched) {
      toast.success("Conciliación guardada", { description: "Se encontró y marcó la recolección correspondiente." });
    } else {
      toast.warning("Conciliación guardada", {
        description: "No se encontró una recolección con ese número de servicio.",
      });
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm" aria-label="Editar" />
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
            Agregar conciliación manual
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conciliación" : "Nueva conciliación"}</DialogTitle>
          <DialogDescription>
            Los campos marcados con * son obligatorios. Al guardar se busca automáticamente la
            recolección con el mismo número de servicio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="service_number">Número del servicio *</Label>
              <Input id="service_number" {...register("service_number")} />
              {errors.service_number && (
                <p className="text-sm text-destructive">{errors.service_number.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="service_date">Fecha del servicio</Label>
              <Input id="service_date" type="date" {...register("service_date")} />
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
              {errors.client_id && (
                <p className="text-sm text-destructive">{errors.client_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client_name">Nombre del cliente</Label>
              <Input id="client_name" {...register("client_name")} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="novedad">Novedad</Label>
              <Input id="novedad" {...register("novedad")} />
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
              <Label htmlFor="cedi_code">Código CEDI</Label>
              <Input id="cedi_code" {...register("cedi_code")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cedi_name">Nombre CEDI</Label>
              <Input id="cedi_name" {...register("cedi_name")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="load_type_id">Tipo de servicio</Label>
              <select
                id="load_type_id"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                {...register("load_type_id")}
              >
                <option value="">Sin definir</option>
                {loadTypes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="service_address">Dirección del servicio</Label>
              <Input id="service_address" {...register("service_address")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client_document">Documento del cliente</Label>
              <Input id="client_document" {...register("client_document")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="collection_amount">Recaudo *</Label>
              <Input
                id="collection_amount"
                type="number"
                step="0.01"
                min="0"
                {...register("collection_amount")}
              />
              {errors.collection_amount && (
                <p className="text-sm text-destructive">{errors.collection_amount.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear conciliación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
