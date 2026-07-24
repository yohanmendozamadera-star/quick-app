import { z } from "zod";
import type { ResourcesCountRange } from "@/lib/additional-services/types";

// Solo caracteres permitidos en una cedula: digitos (y opcionalmente letras
// para extranjeria/pasaporte), sin espacios ni simbolos.
const documentRegex = /^[A-Za-z0-9]+$/;

// Todos los campos del formulario son obligatorios (a pedido explícito),
// salvo la identidad individual del recurso, que solo aplica cuando la
// solicitud es de "1 a 5" recursos (con "6 o más" no existe esa fila).
const sharedFields = {
  coordinator_id: z.string().min(1, "El coordinador es obligatorio").uuid("Coordinador inválido"),
  cenlog_id: z.string().min(1, "El CENLOG es obligatorio").uuid("CENLOG inválido"),
  cedi_id: z.string().min(1, "El código de droguería es obligatorio").uuid("Droguería inválida"),
  service_type_id: z.string().min(1, "El tipo de servicio es obligatorio").uuid("Tipo de servicio inválido"),
  service_date: z.string().min(1, "La fecha del servicio es obligatoria"),
  transport_type_id: z.string().min(1, "El tipo de transporte es obligatorio").uuid("Tipo de transporte inválido"),
  charge_description_id: z
    .string()
    .min(1, "La descripción del cobro es obligatoria")
    .uuid("Descripción del cobro inválida"),
  start_time: z.string().min(1, "El horario de inicio es obligatorio"),
  end_time: z.string().min(1, "El horario de finalización es obligatorio"),
  services_count: z.coerce
    .number({ message: "La cantidad de servicios debe ser un número" })
    .int("La cantidad de servicios debe ser un número entero")
    .min(0, "La cantidad de servicios no puede ser negativa"),
  delivery_support_note: z.string().trim().min(1, "La observación del soporte de entregas es obligatoria"),
  client_authorization_note: z
    .string()
    .trim()
    .min(1, "La observación de la autorización del cliente es obligatoria"),
};

function checkTimeRange(values: { start_time?: string; end_time?: string }) {
  if (!values.start_time || !values.end_time) return true;
  return values.end_time >= values.start_time;
}

const TIME_RANGE_ISSUE = {
  message: "La hora final no puede ser anterior a la hora inicial",
  path: ["end_time"] as PropertyKey[],
};

const resourceSchema = z.object({
  resource_name: z.string().trim().min(1, "El nombre del recurso es obligatorio"),
  resource_document: z
    .string()
    .trim()
    .min(1, "La cédula del recurso es obligatoria")
    .regex(documentRegex, "La cédula solo puede contener letras y números"),
  plate: z.string().trim().min(1, "La placa es obligatoria"),
});

// Creacion: agrupa 1 a 5 recursos individuales bajo la misma solicitud, o
// una sola fila agregada cuando son 6 o mas (sin identidad individual).
export const additionalServiceCreateSchema = z
  .object({
    ...sharedFields,
    resources_count_range: z.enum(["1-5", "6+"]),
    resources: z.array(resourceSchema).max(5, "Máximo 5 recursos individuales"),
  })
  .refine(checkTimeRange, TIME_RANGE_ISSUE)
  .refine((values) => values.resources_count_range === "6+" || values.resources.length >= 1, {
    message: "Agrega al menos un recurso",
    path: ["resources"],
  });

// Edicion: cada fila es un recurso puntual (o la fila agregada de "6 o mas").
// resources_count_range viaja de solo lectura (no se puede cambiar despues de
// creada la solicitud) para saber si la identidad del recurso es obligatoria.
export const additionalServiceEditSchema = z
  .object({
    ...sharedFields,
    resources_count_range: z.enum(["1-5", "6+"]),
    resource_name: z.string().optional(),
    resource_document: z.string().optional(),
    plate: z.string().optional(),
  })
  .refine(checkTimeRange, TIME_RANGE_ISSUE)
  .superRefine((values, ctx) => {
    if (values.resources_count_range !== "1-5") return;
    if (!values.resource_name?.trim()) {
      ctx.addIssue({ code: "custom", message: "El nombre del recurso es obligatorio", path: ["resource_name"] });
    }
    if (!values.resource_document?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "La cédula del recurso es obligatoria",
        path: ["resource_document"],
      });
    } else if (!documentRegex.test(values.resource_document.trim())) {
      ctx.addIssue({
        code: "custom",
        message: "La cédula solo puede contener letras y números",
        path: ["resource_document"],
      });
    }
    if (!values.plate?.trim()) {
      ctx.addIssue({ code: "custom", message: "La placa es obligatoria", path: ["plate"] });
    }
  });

export type AdditionalServiceCreateValues = z.input<typeof additionalServiceCreateSchema>;
export type AdditionalServiceCreateOutput = z.output<typeof additionalServiceCreateSchema>;
export type AdditionalServiceEditValues = z.input<typeof additionalServiceEditSchema>;
export type AdditionalServiceEditOutput = z.output<typeof additionalServiceEditSchema>;

export type AdditionalServiceInsertRow = {
  coordinator_id: string;
  cenlog_id: string | null;
  cedi_id: string;
  service_type_id: string;
  service_date: string;
  transport_type_id: string | null;
  charge_description_id: string | null;
  start_time: string | null;
  end_time: string | null;
  services_count: number;
  delivery_support_note: string | null;
  client_authorization_note: string | null;
  resources_count_range: ResourcesCountRange;
  resource_group_id: string | null;
  resource_name: string | null;
  resource_document: string | null;
  plate: string | null;
};

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizePlate(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

function normalizeSharedInput(values: AdditionalServiceCreateOutput | AdditionalServiceEditOutput) {
  return {
    coordinator_id: values.coordinator_id,
    cenlog_id: values.cenlog_id,
    cedi_id: values.cedi_id,
    service_type_id: values.service_type_id,
    service_date: values.service_date,
    transport_type_id: values.transport_type_id,
    charge_description_id: values.charge_description_id,
    start_time: values.start_time,
    end_time: values.end_time,
    services_count: values.services_count,
    delivery_support_note: values.delivery_support_note,
    client_authorization_note: values.client_authorization_note,
  };
}

/** Una fila por recurso (1 a 5) o una única fila agregada (6 o más). */
export function buildCreateRows(
  values: AdditionalServiceCreateOutput,
  resourceGroupId: string | null,
): AdditionalServiceInsertRow[] {
  const shared = normalizeSharedInput(values);

  if (values.resources_count_range === "6+") {
    return [
      {
        ...shared,
        resources_count_range: "6+",
        resource_group_id: null,
        resource_name: null,
        resource_document: null,
        plate: null,
      },
    ];
  }

  return values.resources.map((r) => ({
    ...shared,
    resources_count_range: "1-5",
    resource_group_id: values.resources.length > 1 ? resourceGroupId : null,
    resource_name: r.resource_name.trim(),
    resource_document: r.resource_document.trim(),
    plate: normalizePlate(r.plate),
  }));
}

export function normalizeEditInput(values: AdditionalServiceEditOutput) {
  return {
    ...normalizeSharedInput(values),
    resource_name: values.resources_count_range === "1-5" ? emptyToNull(values.resource_name) : null,
    resource_document: values.resources_count_range === "1-5" ? emptyToNull(values.resource_document) : null,
    plate: values.resources_count_range === "1-5" ? normalizePlate(values.plate) : null,
  };
}
