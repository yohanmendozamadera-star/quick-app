import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardDetailRow } from "@/lib/dashboard/types";
import type { CatalogOption } from "@/lib/catalog/queries";

export function SummaryCards({
  detailRows,
  clients,
  cities,
}: {
  detailRows: DashboardDetailRow[];
  clients: CatalogOption[];
  cities: CatalogOption[];
}) {
  const totalsByClient: Record<string, number> = {};
  const totalsByCity: Record<string, number> = {};
  let grandTotal = 0;

  for (const row of detailRows) {
    const total = row.automatic_count + row.manual_quantity;
    totalsByClient[row.client_id] = (totalsByClient[row.client_id] ?? 0) + total;
    totalsByCity[row.city_id] = (totalsByCity[row.city_id] ?? 0) + total;
    grandTotal += total;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de paquetes (período)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{grandTotal.toLocaleString("es-CO")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Por cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{c.name}</span>
              <span className="font-medium">{(totalsByClient[c.id] ?? 0).toLocaleString("es-CO")}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Por ciudad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {cities.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{c.name}</span>
              <span className="font-medium">{(totalsByCity[c.id] ?? 0).toLocaleString("es-CO")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
