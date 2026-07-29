import { Download } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getCollections } from "@/lib/collections/queries";
import { getClients, getVisibleCities, getLoadTypes } from "@/lib/catalog/queries";
import { DEFAULT_PAGE_SIZE, type CollectionsSort, type ReconciliationStatus } from "@/lib/collections/types";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { CollectionsFilters } from "@/components/recoleccion/collections-filters";
import { CollectionsTable } from "@/components/recoleccion/collections-table";
import { CollectionFormDialog } from "@/components/recoleccion/collection-form-dialog";
import { BulkImportDialog } from "@/components/recoleccion/bulk-import-dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, getTodayBogota } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

const SORTABLE_COLUMNS = new Set(["service_date", "service_number", "collection_amount", "created_at"]);

export default async function RecoleccionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "recoleccion.view")) {
    return (
      <ModulePlaceholder
        title="Recolección"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  const page = Math.max(1, Number(str(sp, "page")) || 1);
  const pageSize = Number(str(sp, "pageSize")) || DEFAULT_PAGE_SIZE;
  const rawSort = str(sp, "sort");
  const sort: CollectionsSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "service_date") as CollectionsSort["column"],
    direction: str(sp, "dir") === "asc" ? "asc" : "desc",
  };

  const loadTypesParam = str(sp, "loadTypes");

  // Si el usuario aun no ha tocado el filtro de fecha, se parte del dia de
  // hoy. Si lo dejo vacio a proposito (?from=), se respeta como "sin limite".
  const dateFrom = "from" in sp ? str(sp, "from") || undefined : getTodayBogota();
  const dateTo = "to" in sp ? str(sp, "to") || undefined : getTodayBogota();

  const opportunityParam = str(sp, "opportunity");

  const filters = {
    search: str(sp, "q"),
    dateFrom,
    dateTo,
    clientId: str(sp, "client"),
    cityId: str(sp, "city"),
    loadTypeIds: loadTypesParam ? loadTypesParam.split(",").filter(Boolean) : undefined,
    reconciliationStatus: str(sp, "status") as ReconciliationStatus | undefined,
    opportunityMinDays: opportunityParam ? Number(opportunityParam) : undefined,
  };

  const [{ rows, count, totals }, clients, cities, loadTypes] = await Promise.all([
    getCollections({ filters, sort, page, pageSize }),
    getClients(),
    getVisibleCities(),
    getLoadTypes(),
  ]);

  const canCreate = can(permissions, "recoleccion.create");
  const canImport = can(permissions, "recoleccion.import");
  const canExport = can(permissions, "recoleccion.export");

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("q", filters.search);
  if (dateFrom) exportParams.set("from", dateFrom);
  if (dateTo) exportParams.set("to", dateTo);
  if (filters.clientId) exportParams.set("client", filters.clientId);
  if (filters.cityId) exportParams.set("city", filters.cityId);
  if (filters.loadTypeIds?.length) exportParams.set("loadTypes", filters.loadTypeIds.join(","));
  if (filters.reconciliationStatus) exportParams.set("status", filters.reconciliationStatus);
  if (filters.opportunityMinDays) exportParams.set("opportunity", String(filters.opportunityMinDays));
  exportParams.set("sort", sort.column);
  exportParams.set("dir", sort.direction);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recolección</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count.toLocaleString("es-CO")} registro{totals.count === 1 ? "" : "s"} ·{" "}
            {formatCurrency(totals.amount)} en recaudo
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canExport && (
            <a
              href={`/recoleccion/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Download className="size-4" />
              Descargar Excel
            </a>
          )}
          {canImport && <BulkImportDialog clients={clients} cities={cities} loadTypes={loadTypes} />}
          {canCreate && (
            <CollectionFormDialog clients={clients} cities={cities} loadTypes={loadTypes} />
          )}
        </div>
      </div>

      <CollectionsFilters clients={clients} cities={cities} loadTypes={loadTypes} />

      <CollectionsTable
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        filters={filters}
        canEdit={can(permissions, "recoleccion.edit")}
        canDelete={can(permissions, "recoleccion.delete")}
        canViewAudit={can(permissions, "audit.view")}
        clients={clients}
        cities={cities}
        loadTypes={loadTypes}
      />
    </div>
  );
}
