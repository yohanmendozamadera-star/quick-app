import { Download } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getServiceTypeRecords } from "@/lib/service-types/queries";
import { getClients, getCities, getTipoServicioLoadTypes } from "@/lib/catalog/queries";
import { DEFAULT_PAGE_SIZE, type ServiceTypeSort, type BillingStatus } from "@/lib/service-types/types";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { ServiceTypeFilters } from "@/components/tipo-servicio/service-type-filters";
import { ServiceTypeTable } from "@/components/tipo-servicio/service-type-table";
import { ServiceTypeFormDialog } from "@/components/tipo-servicio/service-type-form-dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, getTodayBogota } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

const SORTABLE_COLUMNS = new Set(["service_date", "service_number", "collection_amount", "created_at"]);

export default async function TipoServicioPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "tipo_servicio.view")) {
    return (
      <ModulePlaceholder
        title="Tipo de Servicio"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  const page = Math.max(1, Number(str(sp, "page")) || 1);
  const pageSize = Number(str(sp, "pageSize")) || DEFAULT_PAGE_SIZE;
  const rawSort = str(sp, "sort");
  const sort: ServiceTypeSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "service_date") as ServiceTypeSort["column"],
    direction: str(sp, "dir") === "asc" ? "asc" : "desc",
  };

  const loadTypeParam = str(sp, "loadType");

  // Desde/Hasta parten de hoy por defecto. Si se dejan vacías a propósito
  // (?from=/?to=), quedan sin límite.
  const dateFrom = "from" in sp ? str(sp, "from") || undefined : getTodayBogota();
  const dateTo = "to" in sp ? str(sp, "to") || undefined : getTodayBogota();

  const filters = {
    search: str(sp, "q"),
    dateFrom,
    dateTo,
    clientId: str(sp, "client"),
    cityId: str(sp, "city"),
    loadTypeIds: loadTypeParam ? [loadTypeParam] : undefined,
    billingStatus: str(sp, "status") as BillingStatus | undefined,
  };

  const [{ rows, count, totals }, clients, cities, loadTypes] = await Promise.all([
    getServiceTypeRecords({ filters, sort, page, pageSize }),
    getClients(),
    getCities(),
    getTipoServicioLoadTypes(),
  ]);

  const canCreate = can(permissions, "tipo_servicio.create");
  const canExport = can(permissions, "tipo_servicio.export");

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("q", filters.search);
  if (filters.dateFrom) exportParams.set("from", filters.dateFrom);
  if (filters.dateTo) exportParams.set("to", filters.dateTo);
  if (filters.clientId) exportParams.set("client", filters.clientId);
  if (filters.cityId) exportParams.set("city", filters.cityId);
  if (filters.loadTypeIds?.length) exportParams.set("loadType", filters.loadTypeIds[0]);
  if (filters.billingStatus) exportParams.set("status", filters.billingStatus);
  exportParams.set("sort", sort.column);
  exportParams.set("dir", sort.direction);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tipo de Servicio</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count.toLocaleString("es-CO")} registro{totals.count === 1 ? "" : "s"} ·{" "}
            {formatCurrency(totals.value)} en recaudo
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canExport && (
            <a
              href={`/tipo-servicio/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Download className="size-4" />
              Descargar Excel
            </a>
          )}
          {canCreate && <ServiceTypeFormDialog clients={clients} cities={cities} loadTypes={loadTypes} />}
        </div>
      </div>

      <ServiceTypeFilters clients={clients} cities={cities} loadTypes={loadTypes} />

      <ServiceTypeTable
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        filters={filters}
        canEdit={can(permissions, "tipo_servicio.edit")}
        canDelete={can(permissions, "tipo_servicio.delete")}
        canRevert={can(permissions, "tipo_servicio.revert")}
        canViewAudit={can(permissions, "audit.view")}
        clients={clients}
        cities={cities}
        loadTypes={loadTypes}
      />
    </div>
  );
}
