import { getCurrentUser, can } from "@/lib/permissions";
import { getAllClients, getVisibleCities } from "@/lib/catalog/queries";
import { getTodayBogota, formatCurrency } from "@/lib/format";
import { getRecaudos } from "@/lib/recaudos/queries";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { ConsolidadoFilters } from "@/components/clientes/consolidado-filters";
import { RecaudosTable } from "@/components/clientes/recaudos-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export default async function RecaudosPage({ params, searchParams }: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "conciliacion.view")) {
    return <ModulePlaceholder title="Recaudos" description="No tienes permiso para ver este módulo." denied />;
  }
  const { clientId } = await params;
  const sp = await searchParams;
  const str = (key: string) => Array.isArray(sp[key]) ? sp[key][0] : sp[key];
  const dateFrom = str("from") || getTodayBogota();
  const dateTo = str("to") || getTodayBogota();
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) && dateFrom <= dateTo;
  const [clients, cities, result] = await Promise.all([
    getAllClients(), getVisibleCities(),
    validDates ? getRecaudos(clientId, dateFrom, dateTo, str("city")) :
      Promise.resolve({ rows: [], error: { message: "Selecciona un rango de fechas válido: Desde debe ser anterior o igual a Hasta." } }),
  ]);
  const total = result.rows.reduce((sum, row) => sum + Number(row.amount), 0);
  return <div className="space-y-4">
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Recaudos — {clients.find(c => c.id === clientId)?.name ?? "Cliente"}</h1>
      <p className="text-sm text-muted-foreground">Total recaudado: {formatCurrency(total)} · Solo guías sin novedad</p>
      <p className="text-xs text-muted-foreground">Las fechas corresponden a la fecha de conciliación.</p>
    </div>
    <ConsolidadoFilters cities={cities} />
    {result.error ? <Alert variant="destructive">
      <AlertTitle>No se pudieron cargar los recaudos</AlertTitle>
      <AlertDescription>{result.error.message}</AlertDescription>
    </Alert> : <RecaudosTable clientId={clientId} rows={result.rows} canUpload={can(user.permissions,"conciliacion.edit")} canExport={can(user.permissions,"conciliacion.export")} />}
  </div>;
}

