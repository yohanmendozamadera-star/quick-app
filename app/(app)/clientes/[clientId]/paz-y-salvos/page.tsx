import { getCurrentUser, can } from "@/lib/permissions";
import { getPazSalvoResumen, getPazSalvoDocuments, buildPazSalvoPeriodRows } from "@/lib/paz-salvo/queries";
import { getAllClients, getVisibleCities } from "@/lib/catalog/queries";
import { getTodayBogota } from "@/lib/format";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { PazSalvoFilters } from "@/components/clientes/paz-salvo-filters";
import { PazSalvoTable } from "@/components/clientes/paz-salvo-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

function currentMonth() {
  return getTodayBogota().slice(0, 7);
}

export default async function PazYSalvosPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "conciliacion.view")) {
    return (
      <ModulePlaceholder
        title="Paz y Salvos"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const { clientId } = await params;
  const sp = await searchParams;

  const monthFrom = `${("from" in sp ? str(sp, "from") || currentMonth() : currentMonth())}-01`;
  const monthTo = `${("to" in sp ? str(sp, "to") || currentMonth() : currentMonth())}-01`;
  const cityId = str(sp, "city");

  const [clients, { detailRows, error }, documents, cities] = await Promise.all([
    getAllClients(),
    getPazSalvoResumen(clientId, { monthFrom, monthTo, cityId }),
    getPazSalvoDocuments(clientId),
    getVisibleCities(),
  ]);

  const client = clients.find((c) => c.id === clientId);
  const periodRows = buildPazSalvoPeriodRows(detailRows, documents);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Paz y Salvos — {client?.name ?? "Cliente"}</h1>
        <p className="text-sm text-muted-foreground">Estado mensual por ciudad y CEDI</p>
      </div>

      <PazSalvoFilters cities={cities} />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>No se pudo cargar Paz y Salvos</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <PazSalvoTable clientId={clientId} periodRows={periodRows} cities={cities} />
    </div>
  );
}
