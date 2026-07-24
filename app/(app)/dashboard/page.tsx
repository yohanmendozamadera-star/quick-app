import { AlertTriangle } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getDashboardOperacion, buildDateRows } from "@/lib/dashboard/queries";
import { getClients, getCities } from "@/lib/catalog/queries";
import { getMonthStartBogota, getTodayBogota } from "@/lib/format";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { OperacionTable } from "@/components/dashboard/operacion-table";
import { ManualAdjustmentDialog } from "@/components/dashboard/manual-adjustment-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "dashboard.view")) {
    return (
      <ModulePlaceholder
        title="Dashboard"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  // Por defecto muestra desde el día 1 del mes actual hasta hoy.
  const dateFrom = "from" in sp ? str(sp, "from") || getMonthStartBogota() : getMonthStartBogota();
  const dateTo = "to" in sp ? str(sp, "to") || getTodayBogota() : getTodayBogota();

  const [{ detailRows, error }, clients, cities] = await Promise.all([
    getDashboardOperacion(dateFrom, dateTo),
    getClients(),
    getCities(),
  ]);

  const dateRows = buildDateRows(detailRows);
  const canAdjust = can(permissions, "dashboard.adjust");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Operación</p>
        </div>

        {canAdjust && <ManualAdjustmentDialog clients={clients} cities={cities} />}
      </div>

      <DashboardFilters />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>No se pudo cargar la operación</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <SummaryCards detailRows={detailRows} clients={clients} cities={cities} />

      <OperacionTable dateRows={dateRows} clients={clients} cities={cities} />
    </div>
  );
}
