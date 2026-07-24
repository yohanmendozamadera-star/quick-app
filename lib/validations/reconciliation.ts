import { z } from "zod";

export const reconciliationFormSchema = z.object({
  service_number: z.string().trim().min(1, "El número del servicio es obligatorio"),
  client_id: z.string().min(1, "El cliente es obligatorio").uuid("Cliente inválido"),
  client_name: z.string().optional(),
  novedad: z.string().optional(),
  city_id: z.string().min(1, "La ciudad es obligatoria").uuid("Ciudad inválida"),
  cedi_code: z.string().optional(),
  cedi_name: z.string().optional(),
  service_address: z.string().optional(),
  service_date: z.string().optional(),
  load_type_id: z.string().optional(),
  client_document: z.string().optional(),
  collection_amount: z.coerce
    .number({ message: "El recaudo debe ser un número" })
    .min(0, "El recaudo no puede ser negativo"),
});

export type ReconciliationFormValues = z.input<typeof reconciliationFormSchema>;
export type ReconciliationFormOutput = z.output<typeof reconciliationFormSchema>;

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Convierte campos opcionales vacíos ("") a null antes de guardar en la base de datos. */
export function normalizeReconciliationInput(values: ReconciliationFormOutput) {
  return {
    ...values,
    service_number: values.service_number.trim(),
    client_name: emptyToNull(values.client_name),
    novedad: emptyToNull(values.novedad),
    cedi_code: emptyToNull(values.cedi_code),
    cedi_name: emptyToNull(values.cedi_name),
    service_address: emptyToNull(values.service_address),
    service_date: emptyToNull(values.service_date),
    load_type_id: emptyToNull(values.load_type_id),
    client_document: emptyToNull(values.client_document),
  };
}
