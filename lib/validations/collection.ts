import { z } from "zod";

export const collectionFormSchema = z.object({
  service_number: z.string().trim().min(1, "El número del servicio es obligatorio"),
  client_id: z.string().min(1, "El cliente es obligatorio").uuid("Cliente inválido"),
  client_name: z.string().optional(),
  note: z.string().optional(),
  driver_name: z.string().optional(),
  city_id: z.string().min(1, "La ciudad es obligatoria").uuid("Ciudad inválida"),
  cedi_name: z.string().optional(),
  service_address: z.string().optional(),
  service_date: z.string().min(1, "La fecha del servicio es obligatoria"),
  load_type_id: z.string().optional(),
  client_document: z.string().optional(),
  collection_amount: z.coerce
    .number({ message: "El recaudo debe ser un número" })
    .min(0, "El recaudo no puede ser negativo"),
});

// "Input" es la forma que maneja el formulario (collection_amount llega como
// texto del <input type="number">); "output" es la forma ya coercionada que
// produce zod después de validar, usada del lado del servidor.
export type CollectionFormValues = z.input<typeof collectionFormSchema>;
export type CollectionFormOutput = z.output<typeof collectionFormSchema>;

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** Convierte campos opcionales vacíos ("") a null antes de guardar en la base de datos. */
export function normalizeCollectionInput(values: CollectionFormOutput) {
  return {
    ...values,
    service_number: values.service_number.trim(),
    client_name: emptyToNull(values.client_name),
    note: emptyToNull(values.note),
    driver_name: emptyToNull(values.driver_name),
    cedi_name: emptyToNull(values.cedi_name),
    service_address: emptyToNull(values.service_address),
    load_type_id: emptyToNull(values.load_type_id),
    client_document: emptyToNull(values.client_document),
  };
}
