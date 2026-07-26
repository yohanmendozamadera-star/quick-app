import { z } from "zod";

export const availabilityFormSchema = z.object({
  client_id: z.string().min(1, "El cliente es obligatorio").uuid("Cliente inválido"),
  service_type_id: z.string().min(1, "El tipo de servicio es obligatorio").uuid("Tipo de servicio inválido"),
  quicker_name: z.string().trim().min(1, "El nombre del Quicker es obligatorio"),
  cedula: z
    .string()
    .trim()
    .min(1, "La cédula es obligatoria")
    .regex(/^[0-9]+$/, "La cédula solo puede contener números"),
  date: z.string().min(1, "La fecha es obligatoria"),
  payment: z.coerce
    .number({ message: "El pago debe ser un número" })
    .min(0, "El pago no puede ser negativo"),
  concept: z.string().optional(),
  observation: z.string().max(100, "Máximo 100 caracteres").optional(),
});

export type AvailabilityFormValues = z.input<typeof availabilityFormSchema>;
export type AvailabilityFormOutput = z.output<typeof availabilityFormSchema>;

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function normalizeAvailabilityInput(values: AvailabilityFormOutput) {
  return {
    client_id: values.client_id,
    service_type_id: values.service_type_id,
    quicker_name: values.quicker_name.trim(),
    cedula: values.cedula.trim(),
    date: values.date,
    payment: values.payment,
    concept: emptyToNull(values.concept),
    observation: emptyToNull(values.observation),
  };
}
