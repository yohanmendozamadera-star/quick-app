import { getCurrentUser, can } from "@/lib/permissions";
import { getConsolidadoResumen, buildConsolidadoDateRows } from "@/lib/consolidado/queries";
import { getAllClients, getVisibleCities } from "@/lib/catalog/queries";
import { getTodayBogota } from "@/lib/format";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { ConsolidadoFilters } from "@/components/clientes/consolidado-filters";
import { ConsolidadoTable } from "@/components/clientes/consolidado-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConsolidadoPage({
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
        title="Consolidado"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const { clientId } = await params;
  const sp = await searchParams;

  const dateFrom = "from" in sp ? str(sp, "from") || getTodayBogota() : getTodayBogota();
  const dateTo = "to" in sp ? str(sp, "to") || getTodayBogota() : getTodayBogota();
  const cityId = str(sp, "city");

  const [clients, { detailRows, error }, cities] = await Promise.all([
    getAllClients(),
    getConsolidadoResumen(clientId, { dateFrom, dateTo, cityId }),
    getVisibleCities(),
  ]);

  const client = clients.find((c) => c.id === clientId);
  const dateRows = buildConsolidadoDateRows(detailRows);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Consolidado — {client?.name ?? "Cliente"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Recolectado, conciliado y pendiente por ciudad y CEDI
        </p>
      </div>

      <ConsolidadoFilters cities={cities} />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>No se pudo cargar el consolidado</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <ConsolidadoTable
        clientId={clientId}
        dateRows={dateRows}
        cities={cities}
        filterDateFrom={dateFrom}
        filterDateTo={dateTo}
      />
    </div>
  );
}
