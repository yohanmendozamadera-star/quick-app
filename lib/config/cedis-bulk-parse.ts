import type { CatalogOption } from "@/lib/catalog/queries";

// Orden de columnas del texto pegado (separado por tabulaciones), igual al
// formato que ya usa el usuario: CODIGO, CIUDAD, CEDI (nombre de la droguería).
export const CEDIS_BULK_COLUMN_LABELS = ["Código", "Ciudad", "Droguería"] as const;

export type ParsedBulkCedi = {
  rowNumber: number;
  raw: string;
  code: string;
  city_input: string;
  city_id: string | null;
  name: string;
  errors: string[];
  duplicateInPaste: boolean;
};

function findCityByName(cities: CatalogOption[], name: string | undefined) {
  if (!name) return null;
  const normalized = name.trim().toLocaleLowerCase("es-CO");
  return cities.find((c) => c.name.trim().toLocaleLowerCase("es-CO") === normalized) ?? null;
}

export function parseCedisBulkText(text: string, cities: CatalogOption[]): ParsedBulkCedi[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seenCodes = new Set<string>();

  return lines.map((line, index) => {
    const cols = line.split("\t").map((c) => c.trim());
    const [codeRaw, cityInput, nameRaw] = cols;

    const errors: string[] = [];

    const code = codeRaw?.trim().toUpperCase() ?? "";
    if (!code) errors.push("Código vacío");

    const duplicateInPaste = code.length > 0 && seenCodes.has(code);
    if (code) seenCodes.add(code);
    if (duplicateInPaste) errors.push("Código repetido en este pegado");

    const city = findCityByName(cities, cityInput);
    if (!cityInput) errors.push("Ciudad vacía");
    else if (!city) errors.push(`Ciudad no reconocida: "${cityInput}"`);

    const name = nameRaw?.trim() ?? "";
    if (!name) errors.push("Nombre de la droguería vacío");

    return {
      rowNumber: index + 1,
      raw: line,
      code,
      city_input: cityInput ?? "",
      city_id: city?.id ?? null,
      name,
      errors,
      duplicateInPaste,
    };
  });
}
