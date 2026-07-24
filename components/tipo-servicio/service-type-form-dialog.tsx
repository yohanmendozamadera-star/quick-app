"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  serviceTypeRecordFormSchema,
  type ServiceTypeRecordFormValues,
} from "@/lib/validations/service-type-record";
import { createServiceTypeRecord, updateServiceTypeRecord } from "@/app/(app)/tipo-servicio/actions";
import type { ServiceTypeViewRow } from "@/lib/service-types/types";
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
  record?: ServiceTypeViewRow;
};

function toFormValues(record?: ServiceTypeViewRow): ServiceTypeRecordFormValues {
  return {
    service_number: record?.service_number ?? "",
    client_id: record?.client_id ?? "",
    client_name: record?.client_name ?? "",
    city_id: record?.city_id ?? "",
    cedi_code: record?.cedi_code ?? "",
    cedi_name: record?.cedi_name ?? "",
    service_address: record?.service_address ?? "",
    service_date: record?.service_date ?? "",
    load_type_id: record?.load_type_id ?? "",
    client_document: record?.client_document ?? "",
    collection_amount: record?.collection_amount ?? 0,
  };
}

export function ServiceTypeFormDialog({ clients, cities, loadTypes, record }: Props) {
  const isEdit = Boolean(record);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceTypeRecordFormValues>({
    resolver: zodResolver(serviceTypeRecordFormSchema),
    defaultValues: toFormValues(record),
  });

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) reset(toFormValues(record));
  };

  const onSubmit = async (values: ServiceTypeRecordFormValues) => {
    setSubmitting(true);
    const result = isEdit
      ? await updateServiceTypeRecord(record!.id, values)
      : await createServiceTypeRecord(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    if (result.matched) {
      toast.success("Registro guardado", { description: "Se encontró y marcó la recolección correspondiente." });
    } else {
      toast.warning("Registro guardado", {
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
            Agregar manual
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar registro" : "Nuevo registro"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Este registro también existe en Conciliación: los cambios se ven en ambos módulos."
              : "Se crea un registro nuevo de Conciliación, visible aquí y en ese módulo."}{" "}
            Los campos marcados con * son obligatorios.
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
              <Label htmlFor="service_date">Fecha del servicio *</Label>
              <Input id="service_date" type="date" {...register("service_date")} />
              {errors.service_date && (
                <p className="text-sm text-destructive">{errors.service_date.message}</p>
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
              {errors.client_id && (
                <p className="text-sm text-destructive">{errors.client_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client_name">Nombre del cliente</Label>
              <Input id="client_name" {...register("client_name")} />
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
              <Label htmlFor="load_type_id">Tipo de servicio *</Label>
              <select
                id="load_type_id"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                {...register("load_type_id")}
              >
                <option value="">Selecciona…</option>
                {loadTypes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              {errors.load_type_id && (
                <p className="text-sm text-destructive">{errors.load_type_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cedi_code">Código CEDI</Label>
              <Input id="cedi_code" {...register("cedi_code")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cedi_name">Nombre CEDI</Label>
              <Input id="cedi_name" {...register("cedi_name")} />
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
              {isEdit ? "Guardar cambios" : "Crear registro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
