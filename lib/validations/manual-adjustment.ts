import { z } from "zod";

export const manualAdjustmentFormSchema = z.object({
  adjustment_date: z.string().min(1, "La fecha es obligatoria"),
  client_id: z.string().min(1, "El cliente es obligatorio").uuid("Cliente inválido"),
  city_id: z.string().min(1, "La ciudad es obligatoria").uuid("Ciudad inválida"),
  quantity: z.coerce
    .number({ message: "La cantidad debe ser un número" })
    .int("La cantidad debe ser un número entero")
    .refine((v) => v !== 0, "La cantidad no puede ser cero"),
  reason: z.string().trim().min(1, "El motivo del ajuste es obligatorio"),
  observation: z.string().optional(),
});

export type ManualAdjustmentFormValues = z.input<typeof manualAdjustmentFormSchema>;
export type ManualAdjustmentFormOutput = z.output<typeof manualAdjustmentFormSchema>;

export function normalizeManualAdjustmentInput(values: ManualAdjustmentFormOutput) {
  const trimmedObservation = values.observation?.trim();
  return {
    ...values,
    reason: values.reason.trim(),
    observation: trimmedObservation && trimmedObservation.length > 0 ? trimmedObservation : null,
  };
}
