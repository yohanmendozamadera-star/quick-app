import { parseDdMmYyyy } from "@/lib/format";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";

// Orden de columnas del texto pegado (separado por tabulaciones). Igual que
// Recolección: Ciudad y Nombre CEDI no se pegan, se calculan solos a partir
// del Código CEDI contra Configuraciones > Droguerías.
export const BULK_COLUMN_LABELS = [
  "Número del servicio",
  "Nombre del cliente",
  "Novedad",
  "Código CEDI",
  "Dirección del servicio",
  "Fecha del servicio",
  "Tipo de servicio",
  "Documento del cliente",
  "Recaudo",
] as const;

export const BULK_REQUIRED_LABELS = [
  "Número del servicio",
  "Código CEDI",
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
  cediResolved: boolean;
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

function findCediByCode(cedis: CediOption[], code: string | null) {
  if (!code) return null;
  const normalized = code.toLocaleLowerCase("es-CO");
  return cedis.find((c) => c.code.toLocaleLowerCase("es-CO") === normalized) ?? null;
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
  loadTypes: CatalogOption[],
  cedis: CediOption[],
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
      cediCodeRaw,
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

    const cedi_code = toNullable(cediCodeRaw);
    if (!cedi_code) errors.push("Código CEDI vacío");

    // Ciudad y Nombre CEDI no se pegan: se calculan solos a partir del
    // código contra Configuraciones > Droguerías. Si el código no está
    // registrado ahí, la fila queda con error.
    const cediMatch = findCediByCode(cedis, cedi_code);
    const cediResolved = cediMatch !== null;

    let city_id: string | null = null;
    let city_input = "";
    let cedi_name: string | null = null;

    if (cediMatch) {
      city_id = cediMatch.city_id;
      city_input = cediMatch.city?.name ?? "";
      cedi_name = cediMatch.name;
    } else if (cedi_code) {
      errors.push(
        `Código CEDI "${cedi_code}" no registrado en Configuraciones > Droguerías. Regístralo antes de cargar.`,
      );
    }

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
      city_input,
      city_id,
      cedi_code,
      cedi_name,
      cediResolved,
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
