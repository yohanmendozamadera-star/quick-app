import { Download } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getReconciliations } from "@/lib/reconciliations/queries";
import { getClients, getCities, getLoadTypes } from "@/lib/catalog/queries";
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

  // "Fecha del servicio" desde/hasta parte de hoy por defecto (igual que en
  // Recolección). Si se dejan vacías a propósito (?sfrom=/?sto=), quedan sin
  // límite.
  const dateFrom = "sfrom" in sp ? str(sp, "sfrom") || undefined : getTodayBogota();
  const dateTo = "sto" in sp ? str(sp, "sto") || undefined : getTodayBogota();

  const filters = {
    search: str(sp, "q"),
    dateFrom,
    dateTo,
    clientId: str(sp, "client"),
    cityId: str(sp, "city"),
  };

  const [{ rows, count, totals }, clients, cities, loadTypes] = await Promise.all([
    getReconciliations({ filters, sort, page, pageSize }),
    getClients(),
    getCities(),
    getLoadTypes(),
  ]);

  const canCreate = can(permissions, "conciliacion.create");
  const canImport = can(permissions, "conciliacion.import");
  const canExport = can(permissions, "conciliacion.export");

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("q", filters.search);
  if (filters.dateFrom) exportParams.set("sfrom", filters.dateFrom);
  if (filters.dateTo) exportParams.set("sto", filters.dateTo);
  if (filters.clientId) exportParams.set("client", filters.clientId);
  if (filters.cityId) exportParams.set("city", filters.cityId);
  exportParams.set("sort", sort.column);
  exportParams.set("dir", sort.direction);

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
          {canExport && (
            <a
              href={`/conciliacion/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Download className="size-4" />
              Descargar Excel
            </a>
          )}
          {canImport && <BulkImportDialog clients={clients} cities={cities} loadTypes={loadTypes} />}
          {canCreate && <ReconciliationFormDialog clients={clients} cities={cities} loadTypes={loadTypes} />}
        </div>
      </div>

      <ReconciliationsFilters clients={clients} cities={cities} />

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
