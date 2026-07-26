import { getCurrentUser, can } from "@/lib/permissions";
import { getOperacionResumen } from "@/lib/operacion/queries";
import { getClients, getVisibleCities } from "@/lib/catalog/queries";
import { getTodayBogota } from "@/lib/format";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { OperacionFilters } from "@/components/operacion/operacion-filters";
import { OperacionTable } from "@/components/operacion/operacion-table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, Download } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string) {
  const value = sp[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function OperacionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  if (!can(permissions, "dashboard.view")) {
    return (
      <ModulePlaceholder
        title="Operación"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const sp = await searchParams;

  const dateFrom = "from" in sp ? str(sp, "from") || getTodayBogota() : getTodayBogota();
  const dateTo = "to" in sp ? str(sp, "to") || getTodayBogota() : getTodayBogota();
  const clientId = str(sp, "client");

  const [{ rows, error }, clients, cities] = await Promise.all([
    getOperacionResumen({ dateFrom, dateTo, clientId }),
    getClients(),
    getVisibleCities(),
  ]);

  const exportParams = new URLSearchParams();
  exportParams.set("from", dateFrom);
  exportParams.set("to", dateTo);
  if (clientId) exportParams.set("client", clientId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Operación</h1>
          <p className="text-sm text-muted-foreground">Resumen consolidado por ciudad</p>
        </div>

        <a
          href={`/operacion/export?${exportParams.toString()}`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <Download className="size-4" />
          Descargar Excel
        </a>
      </div>

      <OperacionFilters clients={clients} />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>No se pudo cargar la operación</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <OperacionTable cityRows={rows} cities={cities} />
    </div>
  );
}
