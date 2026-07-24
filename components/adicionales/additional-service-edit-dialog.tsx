"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  additionalServiceEditSchema,
  type AdditionalServiceEditValues,
} from "@/lib/validations/additional-service";
import { updateAdditionalService } from "@/app/(app)/adicionales/actions";
import { createCoordinator, createCenlog } from "@/lib/catalog/actions";
import type { AdditionalServiceRow } from "@/lib/additional-services/types";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComboboxSelect } from "@/components/shared/combobox-select";
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
  record: AdditionalServiceRow;
  coordinators: CatalogOption[];
  cenlogs: CatalogOption[];
  cedis: CediOption[];
  serviceTypes: CatalogOption[];
  transportTypes: CatalogOption[];
  chargeDescriptions: CatalogOption[];
};

function cediOptions(cedis: CediOption[]) {
  return cedis.map((c) => ({ id: c.id, name: `${c.code} · ${c.name}${c.city ? ` (${c.city.name})` : ""}` }));
}

function toFormValues(record: AdditionalServiceRow): AdditionalServiceEditValues {
  return {
    coordinator_id: record.coordinator_id,
    cenlog_id: record.cenlog_id ?? "",
    cedi_id: record.cedi_id,
    service_type_id: record.service_type_id,
    service_date: record.service_date,
    transport_type_id: record.transport_type_id ?? "",
    charge_description_id: record.charge_description_id ?? "",
    start_time: record.start_time ?? "",
    end_time: record.end_time ?? "",
    services_count: record.services_count,
    delivery_support_note: record.delivery_support_note ?? "",
    client_authorization_note: record.client_authorization_note ?? "",
    resources_count_range: record.resources_count_range,
    resource_name: record.resource_name ?? "",
    resource_document: record.resource_document ?? "",
    plate: record.plate ?? "",
  };
}

export function AdditionalServiceEditDialog({
  record,
  coordinators,
  cenlogs,
  cedis,
  serviceTypes,
  transportTypes,
  chargeDescriptions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coordinatorOptions, setCoordinatorOptions] = useState(coordinators);
  const [cenlogOptions, setCenlogOptions] = useState(cenlogs);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AdditionalServiceEditValues>({
    resolver: zodResolver(additionalServiceEditSchema),
    defaultValues: toFormValues(record),
  });

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      reset(toFormValues(record));
      setCoordinatorOptions(coordinators);
      setCenlogOptions(cenlogs);
    }
  };

  const onSubmit = async (values: AdditionalServiceEditValues) => {
    setSubmitting(true);
    const result = await updateAdditionalService(record.id, values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success("Registro actualizado");
    setOpen(false);
  };

  const showResourceFields = record.resources_count_range === "1-5";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Editar" />}>
        <Pencil className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar registro</DialogTitle>
          <DialogDescription>
            Todos los campos son obligatorios. Si el coordinador o el CENLOG no está en la lista, escribe el
            nombre y elige &ldquo;Crear&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <input type="hidden" {...register("resources_count_range")} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="coordinator_id">Coordinador que solicita *</Label>
              <Controller
                control={control}
                name="coordinator_id"
                render={({ field }) => (
                  <ComboboxSelect
                    id="coordinator_id"
                    value={field.value}
                    onChange={field.onChange}
                    options={coordinatorOptions}
                    onCreate={createCoordinator}
                    onOptionCreated={(option) => setCoordinatorOptions((prev) => [...prev, option])}
                    placeholder="Selecciona o crea un coordinador…"
                  />
                )}
              />
              {errors.coordinator_id && (
                <p className="text-sm text-destructive">{errors.coordinator_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cenlog_id">CENLOG *</Label>
              <Controller
                control={control}
                name="cenlog_id"
                render={({ field }) => (
                  <ComboboxSelect
                    id="cenlog_id"
                    value={field.value}
                    onChange={field.onChange}
                    options={cenlogOptions}
                    onCreate={createCenlog}
                    onOptionCreated={(option) => setCenlogOptions((prev) => [...prev, option])}
                    placeholder="Selecciona o crea un CENLOG…"
                  />
                )}
              />
              {errors.cenlog_id && <p className="text-sm text-destructive">{errors.cenlog_id.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cedi_id">Código de droguería *</Label>
              <Controller
                control={control}
                name="cedi_id"
                render={({ field }) => (
                  <ComboboxSelect
                    id="cedi_id"
                    value={field.value}
                    onChange={field.onChange}
                    options={cediOptions(cedis)}
                    placeholder="Busca por código o nombre…"
                  />
                )}
              />
              {errors.cedi_id && <p className="text-sm text-destructive">{errors.cedi_id.message}</p>}
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
              <Label htmlFor="service_date">Fecha del servicio *</Label>
              <Input id="service_date" type="date" {...register("service_date")} />
              {errors.service_date && (
                <p className="text-sm text-destructive">{errors.service_date.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transport_type_id">Tipo de transporte *</Label>
              <select
                id="transport_type_id"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                {...register("transport_type_id")}
              >
                <option value="">Selecciona…</option>
                {transportTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {errors.transport_type_id && (
                <p className="text-sm text-destructive">{errors.transport_type_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="charge_description_id">Descripción del cobro *</Label>
              <select
                id="charge_description_id"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                {...register("charge_description_id")}
              >
                <option value="">Selecciona…</option>
                {chargeDescriptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.charge_description_id && (
                <p className="text-sm text-destructive">{errors.charge_description_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start_time">Horario de inicio del recurso *</Label>
              <Input id="start_time" type="time" {...register("start_time")} />
              {errors.start_time && (
                <p className="text-sm text-destructive">{errors.start_time.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end_time">Horario de finalización del recurso *</Label>
              <Input id="end_time" type="time" {...register("end_time")} />
              {errors.end_time && <p className="text-sm text-destructive">{errors.end_time.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="services_count">Cantidad de servicios *</Label>
              <Input id="services_count" type="number" min="0" step="1" {...register("services_count")} />
              {errors.services_count && (
                <p className="text-sm text-destructive">{errors.services_count.message}</p>
              )}
            </div>

            {showResourceFields && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="resource_name">Nombre del recurso *</Label>
                  <Input id="resource_name" {...register("resource_name")} />
                  {errors.resource_name && (
                    <p className="text-sm text-destructive">{errors.resource_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="resource_document">Cédula del recurso *</Label>
                  <Input id="resource_document" {...register("resource_document")} />
                  {errors.resource_document && (
                    <p className="text-sm text-destructive">{errors.resource_document.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plate">Placa *</Label>
                  <Input id="plate" {...register("plate")} />
                  {errors.plate && <p className="text-sm text-destructive">{errors.plate.message}</p>}
                </div>
              </>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="delivery_support_note">Soporte de entregas *</Label>
              <Input id="delivery_support_note" {...register("delivery_support_note")} />
              {errors.delivery_support_note && (
                <p className="text-sm text-destructive">{errors.delivery_support_note.message}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client_authorization_note">Autorización del cliente *</Label>
              <Input id="client_authorization_note" {...register("client_authorization_note")} />
              {errors.client_authorization_note && (
                <p className="text-sm text-destructive">{errors.client_authorization_note.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
