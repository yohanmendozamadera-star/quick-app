import { Download, FileText } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getReconciliations } from "@/lib/reconciliations/queries";
import { getClients, getVisibleCities, getLoadTypes, getCedis, getVisibleCedis } from "@/lib/catalog/queries";
import { DEFAULT_PAGE_SIZE, type ReconciliationsSort } from "@/lib/reconciliations/types";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { ReconciliationsFilters } from "@/components/conciliacion/reconciliations-filters";
import { ReconciliationsTable } from "@/components/conciliacion/reconciliations-table";
import { ReconciliationFormDialog } from "@/components/conciliacion/reconciliation-form-dialog";
import { BulkImportDialog } from "@/components/conciliacion/bulk-import-dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, getTodayBogota } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

const SORTABLE_COLUMNS = new Set(["service_date", "service_number", "collection_amount", "reconciliation_date"]);

export default async function ConciliacionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "conciliacion.view")) {
    return (
      <ModulePlaceholder
        title="Conciliación"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  const page = Math.max(1, Number(str(sp, "page")) || 1);
  const pageSize = Number(str(sp, "pageSize")) || DEFAULT_PAGE_SIZE;
  const rawSort = str(sp, "sort");
  const sort: ReconciliationsSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort)
      ? rawSort
      : "reconciliation_date") as ReconciliationsSort["column"],
    direction: str(sp, "dir") === "asc" ? "asc" : "desc",
  };

  // "Fecha de conciliación" desde/hasta parte de hoy por defecto (cuándo se
  // cargó el archivo, no la fecha de servicio). Si se dejan vacías a
  // propósito (?cfrom=/?cto=), quedan sin límite.
  const dateFrom = "cfrom" in sp ? str(sp, "cfrom") || undefined : getTodayBogota();
  const dateTo = "cto" in sp ? str(sp, "cto") || undefined : getTodayBogota();

  const filters = {
    search: str(sp, "q"),
    dateFrom,
    dateTo,
    clientId: str(sp, "client"),
    cityId: str(sp, "city"),
    cediCode: str(sp, "cedi"),
  };

  const [{ rows, count, totals }, clients, cities, loadTypes, cedis, visibleCedis] = await Promise.all([
    getReconciliations({ filters, sort, page, pageSize }),
    getClients(),
    getVisibleCities(),
    getLoadTypes(),
    getCedis(),
    getVisibleCedis(),
  ]);

  const canCreate = can(permissions, "conciliacion.create");
  const canImport = can(permissions, "conciliacion.import");
  const canExport = can(permissions, "conciliacion.export");

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("q", filters.search);
  if (filters.dateFrom) exportParams.set("cfrom", filters.dateFrom);
  if (filters.dateTo) exportParams.set("cto", filters.dateTo);
  if (filters.clientId) exportParams.set("client", filters.clientId);
  if (filters.cityId) exportParams.set("city", filters.cityId);
  if (filters.cediCode) exportParams.set("cedi", filters.cediCode);
  exportParams.set("sort", sort.column);
  exportParams.set("dir", sort.direction);

  // El Acta solo tiene sentido con una identidad completa: cliente + ciudad +
  // nodo puntuales (no "Todos"), usando el rango de fechas de conciliación
  // ya filtrado en esta misma vista.
  const canGenerateActa =
    can(permissions, "conciliacion.export") && filters.clientId && filters.cityId && filters.cediCode;
  const selectedCedi = visibleCedis.find((c) => c.code === filters.cediCode);
  const informeParams = new URLSearchParams();
  if (canGenerateActa) {
    informeParams.set("dateFrom", filters.dateFrom || getTodayBogota());
    informeParams.set("dateTo", filters.dateTo || getTodayBogota());
    informeParams.set("cityId", filters.cityId!);
    informeParams.set("cediCode", filters.cediCode!);
    informeParams.set("cediName", selectedCedi?.name ?? filters.cediCode!);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Conciliación</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count.toLocaleString("es-CO")} registro{totals.count === 1 ? "" : "s"} ·{" "}
            {formatCurrency(totals.amount)} en recaudo
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canGenerateActa && (
            <a
              href={`/clientes/${filters.clientId}/consolidado/informe?${informeParams.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <FileText className="size-4" />
              Generar Acta del Nodo
            </a>
          )}
          {canExport && (
            <a
              href={`/conciliacion/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Download className="size-4" />
              Descargar Excel
            </a>
          )}
          {canImport && <BulkImportDialog clients={clients} loadTypes={loadTypes} cedis={cedis} />}
          {canCreate && <ReconciliationFormDialog clients={clients} cities={cities} loadTypes={loadTypes} />}
        </div>
      </div>

      <ReconciliationsFilters clients={clients} cities={cities} cedis={visibleCedis} />

      <ReconciliationsTable
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        filters={filters}
        canEdit={can(permissions, "conciliacion.edit")}
        canDelete={can(permissions, "conciliacion.delete")}
        canViewAudit={can(permissions, "audit.view")}
        clients={clients}
        cities={cities}
        loadTypes={loadTypes}
      />
    </div>
  );
}
