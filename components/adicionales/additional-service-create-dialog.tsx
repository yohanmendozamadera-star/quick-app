"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import {
  additionalServiceCreateSchema,
  type AdditionalServiceCreateValues,
} from "@/lib/validations/additional-service";
import { createAdditionalService } from "@/app/(app)/adicionales/actions";
import { createCoordinator, createCenlog } from "@/lib/catalog/actions";
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
  coordinators: CatalogOption[];
  cenlogs: CatalogOption[];
  cedis: CediOption[];
  serviceTypes: CatalogOption[];
  transportTypes: CatalogOption[];
  chargeDescriptions: CatalogOption[];
};

const EMPTY_RESOURCE = { resource_name: "", resource_document: "", plate: "" };

function cediOptions(cedis: CediOption[]) {
  return cedis.map((c) => ({ id: c.id, name: `${c.code} · ${c.name}${c.city ? ` (${c.city.name})` : ""}` }));
}

function defaultValues(): AdditionalServiceCreateValues {
  return {
    coordinator_id: "",
    cenlog_id: "",
    cedi_id: "",
    service_type_id: "",
    service_date: "",
    transport_type_id: "",
    charge_description_id: "",
    start_time: "",
    end_time: "",
    services_count: 0,
    delivery_support_note: "",
    client_authorization_note: "",
    resources_count_range: "1-5",
    resources: [{ ...EMPTY_RESOURCE }],
  };
}

export function AdditionalServiceCreateDialog({
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
    watch,
    formState: { errors },
  } = useForm<AdditionalServiceCreateValues>({
    resolver: zodResolver(additionalServiceCreateSchema),
    defaultValues: defaultValues(),
  });

  const { fields, append, remove } = useFieldArray({ control, name: "resources" });
  const range = watch("resources_count_range");

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (value) {
      reset(defaultValues());
      setCoordinatorOptions(coordinators);
      setCenlogOptions(cenlogs);
    }
  };

  const onSubmit = async (values: AdditionalServiceCreateValues) => {
    setSubmitting(true);
    const result = await createAdditionalService(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }

    toast.success("Solicitud registrada");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button className="gap-1.5" />}>
        <Plus className="size-4" />
        Agregar manual
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva solicitud de Adicionales</DialogTitle>
          <DialogDescription>
            Todos los campos son obligatorios. Si el coordinador o el CENLOG no está en la lista, escribe el
            nombre y elige &ldquo;Crear&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
              <p className="text-xs text-muted-foreground">
                ¿No aparece? Regístrala primero en Configuraciones &gt; Droguerías.
              </p>
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

            <div className="space-y-1.5">
              <Label htmlFor="resources_count_range">Cantidad de recursos a reportar *</Label>
              <select
                id="resources_count_range"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                {...register("resources_count_range")}
              >
                <option value="1-5">1 a 5</option>
                <option value="6+">6 o más</option>
              </select>
            </div>

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

          {range === "1-5" ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Recursos ({fields.length}/5)</p>
                {fields.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => append({ ...EMPTY_RESOURCE })}
                  >
                    <Plus className="size-3.5" />
                    Agregar recurso
                  </Button>
                )}
              </div>

              {errors.resources?.message && (
                <p className="text-sm text-destructive">{errors.resources.message}</p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-3 border-t pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`resources.${index}.resource_name`}>Nombre del recurso *</Label>
                    <Input id={`resources.${index}.resource_name`} {...register(`resources.${index}.resource_name`)} />
                    {errors.resources?.[index]?.resource_name && (
                      <p className="text-sm text-destructive">
                        {errors.resources[index]?.resource_name?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`resources.${index}.resource_document`}>Cédula del recurso *</Label>
                    <Input
                      id={`resources.${index}.resource_document`}
                      {...register(`resources.${index}.resource_document`)}
                    />
                    {errors.resources?.[index]?.resource_document && (
                      <p className="text-sm text-destructive">
                        {errors.resources[index]?.resource_document?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`resources.${index}.plate`}>Placa *</Label>
                    <Input id={`resources.${index}.plate`} {...register(`resources.${index}.plate`)} />
                    {errors.resources?.[index]?.plate && (
                      <p className="text-sm text-destructive">{errors.resources[index]?.plate?.message}</p>
                    )}
                  </div>
                  <div className="flex items-end">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Quitar recurso"
                        onClick={() => remove(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Con 6 o más recursos no se registra la identidad individual: solo la cantidad de servicios.
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Crear solicitud
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
