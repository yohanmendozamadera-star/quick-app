import { Download } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getAdditionalServices } from "@/lib/additional-services/queries";
import {
  getCoordinators,
  getCenlogs,
  getCedis,
  getServiceTypes,
  getTransportTypes,
  getChargeDescriptions,
} from "@/lib/catalog/queries";
import {
  DEFAULT_PAGE_SIZE,
  type AdditionalServiceSort,
  type AdditionalServiceStatus,
} from "@/lib/additional-services/types";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { AdditionalServicesFilters } from "@/components/adicionales/additional-services-filters";
import { AdditionalServicesTable } from "@/components/adicionales/additional-services-table";
import { AdditionalServiceCreateDialog } from "@/components/adicionales/additional-service-create-dialog";
import { buttonVariants } from "@/components/ui/button";
import { getTodayBogota } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

const SORTABLE_COLUMNS = new Set(["service_date", "services_count", "created_at"]);

export default async function AdicionalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "adicionales.view")) {
    return (
      <ModulePlaceholder
        title="Adicionales"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  const page = Math.max(1, Number(str(sp, "page")) || 1);
  const pageSize = Number(str(sp, "pageSize")) || DEFAULT_PAGE_SIZE;
  const rawSort = str(sp, "sort");
  const sort: AdditionalServiceSort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "service_date") as AdditionalServiceSort["column"],
    direction: str(sp, "dir") === "asc" ? "asc" : "desc",
  };

  // Desde/Hasta parten de hoy por defecto, igual que el resto de módulos. Si
  // se dejan vacías a propósito (?from=/?to=), quedan sin límite.
  const dateFrom = "from" in sp ? str(sp, "from") || undefined : getTodayBogota();
  const dateTo = "to" in sp ? str(sp, "to") || undefined : getTodayBogota();

  const filters = {
    search: str(sp, "q"),
    dateFrom,
    dateTo,
    coordinatorId: str(sp, "coordinator"),
    cenlogId: str(sp, "cenlog"),
    serviceTypeId: str(sp, "serviceType"),
    chargeDescriptionId: str(sp, "chargeDescription"),
    status: str(sp, "status") as AdditionalServiceStatus | undefined,
  };

  const [{ rows, count, totals }, coordinators, cenlogs, cedis, serviceTypes, transportTypes, chargeDescriptions] =
    await Promise.all([
      getAdditionalServices({ filters, sort, page, pageSize }),
      getCoordinators(),
      getCenlogs(),
      getCedis(),
      getServiceTypes("adicionales"),
      getTransportTypes(),
      getChargeDescriptions(),
    ]);

  const canCreate = can(permissions, "adicionales.create");
  const canExport = can(permissions, "adicionales.export");

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("q", filters.search);
  if (filters.dateFrom) exportParams.set("from", filters.dateFrom);
  if (filters.dateTo) exportParams.set("to", filters.dateTo);
  if (filters.coordinatorId) exportParams.set("coordinator", filters.coordinatorId);
  if (filters.cenlogId) exportParams.set("cenlog", filters.cenlogId);
  if (filters.serviceTypeId) exportParams.set("serviceType", filters.serviceTypeId);
  if (filters.chargeDescriptionId) exportParams.set("chargeDescription", filters.chargeDescriptionId);
  if (filters.status) exportParams.set("status", filters.status);
  exportParams.set("sort", sort.column);
  exportParams.set("dir", sort.direction);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Adicionales</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count.toLocaleString("es-CO")} registro{totals.count === 1 ? "" : "s"} ·{" "}
            {totals.services.toLocaleString("es-CO")} servicio{totals.services === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canExport && (
            <a
              href={`/adicionales/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Download className="size-4" />
              Descargar Excel
            </a>
          )}
          {canCreate && (
            <AdditionalServiceCreateDialog
              coordinators={coordinators}
              cenlogs={cenlogs}
              cedis={cedis}
              serviceTypes={serviceTypes}
              transportTypes={transportTypes}
              chargeDescriptions={chargeDescriptions}
            />
          )}
        </div>
      </div>

      <AdditionalServicesFilters
        coordinators={coordinators}
        cenlogs={cenlogs}
        serviceTypes={serviceTypes}
        chargeDescriptions={chargeDescriptions}
      />

      <AdditionalServicesTable
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        filters={filters}
        canEdit={can(permissions, "adicionales.edit")}
        canDelete={can(permissions, "adicionales.delete")}
        canRevert={can(permissions, "adicionales.revert")}
        canViewAudit={can(permissions, "audit.view")}
        coordinators={coordinators}
        cenlogs={cenlogs}
        cedis={cedis}
        serviceTypes={serviceTypes}
        transportTypes={transportTypes}
        chargeDescriptions={chargeDescriptions}
      />
    </div>
  );
}
