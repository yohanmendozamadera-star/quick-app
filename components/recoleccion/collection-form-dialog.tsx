"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import { collectionFormSchema, type CollectionFormValues } from "@/lib/validations/collection";
import { createCollection, updateCollection } from "@/app/(app)/recoleccion/actions";
import type { CollectionRow } from "@/lib/collections/types";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";
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
  cedis: CediOption[];
  collection?: CollectionRow;
};

function toFormValues(collection?: CollectionRow): CollectionFormValues {
  return {
    service_number: collection?.service_number ?? "",
    client_id: collection?.client_id ?? "",
    client_name: collection?.client_name ?? "",
    note: collection?.note ?? "",
    driver_name: collection?.driver_name ?? "",
    city_id: collection?.city_id ?? "",
    cedi_code: collection?.cedi_code ?? "",
    cedi_name: collection?.cedi_name ?? "",
    service_address: collection?.service_address ?? "",
    service_date: collection?.service_date ?? "",
    load_type_id: collection?.load_type_id ?? "",
    client_document: collection?.client_document ?? "",
    collection_amount: collection?.collection_amount ?? 0,
  };
}

export function CollectionFormDialog({ clients, cities, loadTypes, cedis, collection }: Props) {
  const isEdit = Boolean(collection);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: toFormValues(collection),
  });

  // Si el código coincide con una droguería registrada en Configuraciones,
  // se calculan solos la ciudad y el nombre (se pueden seguir editando).
  const handleCediCodeBlur = (code: string) => {
    const match = cedis.find((c) => c.code.toLocaleLowerCase("es-CO") === code.trim().toLocaleLowerCase("es-CO"));
    if (!match) return;
    setValue("cedi_name", match.name);
    if (match.city_id) setValue("city_id", match.city_id);
  };

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) reset(toFormValues(collection));
  };

  const onSubmit = async (values: CollectionFormValues) => {
    setSubmitting(true);
    const result = isEdit
      ? await updateCollection(collection!.id, values)
      : await createCollection(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success(isEdit ? "Recolección actualizada" : "Recolección creada");
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
            Agregar recolección manual
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar recolección" : "Nueva recolección"}</DialogTitle>
          <DialogDescription>
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="note">Novedad</Label>
              <Input id="note" {...register("note")} />
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
              <Label htmlFor="load_type_id">Tipo de carga</Label>
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

            <div className="space-y-1.5">
              <Label htmlFor="cedi_code">Código CEDI (droguería)</Label>
              <Input
                id="cedi_code"
                {...register("cedi_code", { onBlur: (e) => handleCediCodeBlur(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Si el código existe en Configuraciones, la ciudad y el nombre se completan solos.
              </p>
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
              <Label htmlFor="driver_name">Conductor</Label>
              <Input id="driver_name" {...register("driver_name")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client_document">Documento del cliente</Label>
              <Input id="client_document" {...register("client_document")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="collection_amount">Recaudo operación *</Label>
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
              {isEdit ? "Guardar cambios" : "Crear recolección"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
