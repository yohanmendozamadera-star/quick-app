"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Pencil } from "lucide-react";
import { availabilityFormSchema, type AvailabilityFormValues } from "@/lib/validations/availability";
import { createAvailability, updateAvailability } from "@/app/(app)/disponibilidades/actions";
import type { AvailabilityRow } from "@/lib/availabilities/types";
import type { CatalogOption } from "@/lib/catalog/queries";
import { getTodayBogota } from "@/lib/format";
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
  serviceTypes: CatalogOption[];
  cities: CatalogOption[];
  availability?: AvailabilityRow;
};

function toFormValues(availability?: AvailabilityRow): AvailabilityFormValues {
  return {
    client_id: availability?.client_id ?? "",
    service_type_id: availability?.service_type_id ?? "",
    city_id: availability?.city_id ?? "",
    quicker_name: availability?.quicker_name ?? "",
    cedula: availability?.cedula ?? "",
    date: availability?.date ?? getTodayBogota(),
    payment: availability?.payment ?? 0,
    concept: availability?.concept ?? "",
    observation: availability?.observation ?? "",
  };
}

export function AvailabilityFormDialog({ clients, serviceTypes, cities, availability }: Props) {
  const isEdit = Boolean(availability);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: toFormValues(availability),
  });

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) reset(toFormValues(availability));
  };

  const onSubmit = async (values: AvailabilityFormValues) => {
    setSubmitting(true);
    const result = isEdit
      ? await updateAvailability(availability!.id, values)
      : await createAvailability(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success(isEdit ? "Registro actualizado" : "Registro creado");
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
            Agregar disponibilidad
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar disponibilidad" : "Nueva disponibilidad"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "El coordinador y el número de orden no cambian."
              : "El coordinador se toma de tu usuario y el número de orden se genera automáticamente."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label htmlFor="service_type_id">Tipo de servicio *</Label>
              <select
                id="service_type_id"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                {...register("service_type_id")}
              >
                <option value="">Selecciona…</option>
                {serviceTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.service_type_id && (
                <p className="text-sm text-destructive">{errors.service_type_id.message}</p>
              )}
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
              <Label htmlFor="quicker_name">Quicker *</Label>
              <Input id="quicker_name" {...register("quicker_name")} />
              {errors.quicker_name && (
                <p className="text-sm text-destructive">{errors.quicker_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cedula">Cédula *</Label>
              <Input id="cedula" inputMode="numeric" {...register("cedula")} />
              {errors.cedula && <p className="text-sm text-destructive">{errors.cedula.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date">Fecha *</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment">Pago *</Label>
              <Input id="payment" type="number" step="0.01" min="0" {...register("payment")} />
              {errors.payment && <p className="text-sm text-destructive">{errors.payment.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="concept">Concepto</Label>
              <Input id="concept" {...register("concept")} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="observation">Observaciones</Label>
              <Input id="observation" maxLength={100} {...register("observation")} />
              {errors.observation && (
                <p className="text-sm text-destructive">{errors.observation.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Guardar cambios" : "Crear disponibilidad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
