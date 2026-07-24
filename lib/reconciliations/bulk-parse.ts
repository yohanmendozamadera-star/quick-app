import { parseDdMmYyyy } from "@/lib/format";
import type { CatalogOption } from "@/lib/catalog/queries";

// Orden de columnas del texto pegado (separado por tabulaciones). Igual que
// Recolección, incluyendo el tipo de carga ("Tipo de servicio" en tu
// planilla) en la misma posición — si se deja por fuera, todo lo que viene
// después (documento, recaudo) se corre una columna.
export const BULK_COLUMN_LABELS = [
  "Número del servicio",
  "Nombre del cliente",
  "Novedad",
  "Ciudad",
  "Código CEDI",
  "Nombre CEDI",
  "Dirección del servicio",
  "Fecha del servicio",
  "Tipo de servicio",
  "Documento del cliente",
  "Recaudo",
] as const;

export const BULK_REQUIRED_LABELS = [
  "Número del servicio",
  "Ciudad",
  "Código CEDI",
  "Nombre CEDI",
  "Fecha del servicio",
  "Recaudo",
];

export type ParsedBulkReconciliation = {
  rowNumber: number;
  raw: string;
  service_number: string;
  client_name: string | null;
  novedad: string | null;
  city_input: string;
  city_id: string | null;
  cedi_code: string | null;
  cedi_name: string | null;
  service_address: string | null;
  service_date_input: string;
  service_date: string | null;
  load_type_input: string;
  load_type_id: string | null;
  client_document: string | null;
  collection_amount: number | null;
  errors: string[];
  duplicateInPaste: boolean;
};

function findByName(options: CatalogOption[], name: string | undefined) {
  if (!name) return null;
  const normalized = name.trim().toLocaleLowerCase("es-CO");
  return options.find((o) => o.name.trim().toLocaleLowerCase("es-CO") === normalized) ?? null;
}

function toNullable(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function parseAmount(value: string | undefined) {
  if (!value || !value.trim()) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBulkReconciliationsText(
  text: string,
  cities: CatalogOption[],
  loadTypes: CatalogOption[],
): ParsedBulkReconciliation[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seenServiceNumbers = new Set<string>();

  return lines.map((line, index) => {
    const cols = line.split("\t").map((c) => c.trim());
    const [
      serviceNumberRaw,
      clientNameRaw,
      novedadRaw,
      cityInput,
      cediCodeRaw,
      cediNameRaw,
      addressRaw,
      dateInput,
      loadTypeInput,
      documentRaw,
      amountInput,
    ] = cols;

    const errors: string[] = [];

    const service_number = serviceNumberRaw?.trim() ?? "";
    if (!service_number) errors.push("Número del servicio vacío");

    const duplicateInPaste = service_number.length > 0 && seenServiceNumbers.has(service_number);
    if (service_number) seenServiceNumbers.add(service_number);
    if (duplicateInPaste) errors.push("Número del servicio repetido en este pegado");

    const city = findByName(cities, cityInput);
    if (!cityInput) errors.push("Ciudad vacía");
    else if (!city) errors.push(`Ciudad no reconocida: "${cityInput}"`);

    const cedi_code = toNullable(cediCodeRaw);
    if (!cedi_code) errors.push("Código CEDI vacío");

    const cedi_name = toNullable(cediNameRaw);
    if (!cedi_name) errors.push("Nombre CEDI vacío");

    const service_date = parseDdMmYyyy(dateInput);
    if (!dateInput) errors.push("Fecha del servicio vacía");
    else if (!service_date) errors.push(`Fecha inválida: "${dateInput}" (use DD/MM/AAAA)`);

    const loadType = findByName(loadTypes, loadTypeInput);
    if (loadTypeInput && !loadType) errors.push(`Tipo de servicio no reconocido: "${loadTypeInput}"`);

    const collection_amount = parseAmount(amountInput);
    if (!amountInput) errors.push("Recaudo vacío");
    else if (collection_amount === null) errors.push(`Recaudo inválido: "${amountInput}"`);
    else if (collection_amount < 0) errors.push("Recaudo no puede ser negativo");

    return {
      rowNumber: index + 1,
      raw: line,
      service_number,
      client_name: toNullable(clientNameRaw),
      novedad: toNullable(novedadRaw),
      city_input: cityInput ?? "",
      city_id: city?.id ?? null,
      cedi_code,
      cedi_name,
      service_address: toNullable(addressRaw),
      service_date_input: dateInput ?? "",
      service_date,
      load_type_input: loadTypeInput ?? "",
      load_type_id: loadType?.id ?? null,
      client_document: toNullable(documentRaw),
      collection_amount,
      errors,
      duplicateInPaste,
    };
  });
}
