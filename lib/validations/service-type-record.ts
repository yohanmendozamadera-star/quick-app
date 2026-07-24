import { z } from "zod";

// Crea/edita un registro en reconciliations (Tipo de Servicio es una vista
// de Conciliación), con los mismos campos que ese módulo.
export const serviceTypeRecordFormSchema = z.object({
  service_number: z.string().trim().min(1, "El número del servicio es obligatorio"),
  client_id: z.string().min(1, "El cliente es obligatorio").uuid("Cliente inválido"),
  client_name: z.string().optional(),
  city_id: z.string().min(1, "La ciudad es obligatoria").uuid("Ciudad inválida"),
  cedi_code: z.string().optional(),
  cedi_name: z.string().optional(),
  service_address: z.string().optional(),
  service_date: z.string().min(1, "La fecha del servicio es obligatoria"),
  load_type_id: z.string().min(1, "El tipo de servicio es obligatorio").uuid("Tipo de servicio inválido"),
  client_document: z.string().optional(),
  collection_amount: z.coerce
    .number({ message: "El recaudo debe ser un número" })
    .min(0, "El recaudo no puede ser negativo"),
});

export type ServiceTypeRecordFormValues = z.input<typeof serviceTypeRecordFormSchema>;
export type ServiceTypeRecordFormOutput = z.output<typeof serviceTypeRecordFormSchema>;

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeServiceTypeRecordInput(values: ServiceTypeRecordFormOutput) {
  return {
    ...values,
    service_number: values.service_number.trim(),
    client_name: emptyToNull(values.client_name),
    cedi_code: emptyToNull(values.cedi_code),
    cedi_name: emptyToNull(values.cedi_name),
    service_address: emptyToNull(values.service_address),
    client_document: emptyToNull(values.client_document),
  };
}
