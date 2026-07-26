import { Download } from "lucide-react";
import { getCurrentUser, can } from "@/lib/permissions";
import { getAvailabilities } from "@/lib/availabilities/queries";
import { getClients, getServiceTypes } from "@/lib/catalog/queries";
import {
  DEFAULT_PAGE_SIZE,
  type AvailabilitySort,
  type AvailabilityStatus,
} from "@/lib/availabilities/types";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { AvailabilitiesFilters } from "@/components/disponibilidades/availabilities-filters";
import { AvailabilitiesTable } from "@/components/disponibilidades/availabilities-table";
import { AvailabilityFormDialog } from "@/components/disponibilidades/availability-form-dialog";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, getTodayBogota } from "@/lib/format";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

const SORTABLE_COLUMNS = new Set(["date", "payment", "created_at"]);

export default async function DisponibilidadesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "disponibilidades.view")) {
    return (
      <ModulePlaceholder
        title="Disponibilidades"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  const page = Math.max(1, Number(str(sp, "page")) || 1);
  const pageSize = Number(str(sp, "pageSize")) || DEFAULT_PAGE_SIZE;
  const rawSort = str(sp, "sort");
  const sort: AvailabilitySort = {
    column: (rawSort && SORTABLE_COLUMNS.has(rawSort) ? rawSort : "date") as AvailabilitySort["column"],
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
    clientId: str(sp, "client"),
    serviceTypeId: str(sp, "serviceType"),
    status: str(sp, "status") as AvailabilityStatus | undefined,
  };

  const [{ rows, count, totals }, clients, serviceTypes] = await Promise.all([
    getAvailabilities({ filters, sort, page, pageSize }),
    getClients(),
    getServiceTypes("disponibilidades"),
  ]);

  const canCreate = can(permissions, "disponibilidades.create");
  const canExport = can(permissions, "disponibilidades.export");

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set("q", filters.search);
  if (filters.dateFrom) exportParams.set("from", filters.dateFrom);
  if (filters.dateTo) exportParams.set("to", filters.dateTo);
  if (filters.clientId) exportParams.set("client", filters.clientId);
  if (filters.serviceTypeId) exportParams.set("serviceType", filters.serviceTypeId);
  if (filters.status) exportParams.set("status", filters.status);
  exportParams.set("sort", sort.column);
  exportParams.set("dir", sort.direction);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Disponibilidades</h1>
          <p className="text-sm text-muted-foreground">
            {totals.count.toLocaleString("es-CO")} registro{totals.count === 1 ? "" : "s"} ·{" "}
            {formatCurrency(totals.payment)} en pagos
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canExport && (
            <a
              href={`/disponibilidades/export?${exportParams.toString()}`}
              className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
            >
              <Download className="size-4" />
              Descargar Excel
            </a>
          )}
          {canCreate && <AvailabilityFormDialog clients={clients} serviceTypes={serviceTypes} />}
        </div>
      </div>

      <AvailabilitiesFilters clients={clients} serviceTypes={serviceTypes} />

      <AvailabilitiesTable
        rows={rows}
        count={count}
        page={page}
        pageSize={pageSize}
        sortColumn={sort.column}
        sortDirection={sort.direction}
        filters={filters}
        canEdit={can(permissions, "disponibilidades.edit")}
        canDelete={can(permissions, "disponibilidades.delete")}
        canApprove={can(permissions, "disponibilidades.approve")}
        canViewAudit={can(permissions, "audit.view")}
        clients={clients}
        serviceTypes={serviceTypes}
      />
    </div>
  );
}
