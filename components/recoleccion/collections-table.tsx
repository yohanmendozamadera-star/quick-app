"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import type { CollectionRow, CollectionsFilters } from "@/lib/collections/types";
import type { CatalogOption, CediOption } from "@/lib/catalog/queries";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { computeOpportunityDays } from "@/lib/collections/opportunity";
import { deleteCollection, bulkDeleteCollections, getMatchingIds } from "@/app/(app)/recoleccion/actions";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SortLink } from "@/components/data-table/sort-link";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { ResizableCell } from "@/components/data-table/resizable-cell";
import { CollectionFormDialog } from "@/components/recoleccion/collection-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AuditHistoryDialog } from "@/components/shared/audit-history-dialog";
import { PAGE_SIZE_OPTIONS } from "@/lib/collections/types";

function StatusBadge({ status }: { status: CollectionRow["reconciliation_status"] }) {
  return status === "conciliado" ? (
    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Conciliado</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">No conciliado</Badge>
  );
}

export function CollectionsTable({
  rows,
  count,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  filters,
  canEdit,
  canDelete,
  canViewAudit,
  clients,
  cities,
  loadTypes,
  cedis,
}: {
  rows: CollectionRow[];
  count: number;
  page: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  filters: CollectionsFilters;
  canEdit: boolean;
  canDelete: boolean;
  canViewAudit: boolean;
  clients: CatalogOption[];
  cities: CatalogOption[];
  loadTypes: CatalogOption[];
  cedis: CediOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someVisibleSelected = rows.some((r) => selected.has(r.id));
  const selectedIds = Array.from(selected);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = async () => {
    setLoadingAllIds(true);
    const ids = await getMatchingIds(filters);
    setLoadingAllIds(false);
    setSelected(new Set(ids));
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = async (id: string) => {
    const result = await deleteCollection(id);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success("Recolección eliminada");
  };

  const handleBulkDelete = async () => {
    const result = await bulkDeleteCollections(selectedIds);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success(
      `${result.affected} registro${result.affected === 1 ? "" : "s"} eliminado${result.affected === 1 ? "" : "s"}`,
    );
    clearSelection();
  };

  return (
    <div className="rounded-lg border bg-background">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-4 py-2 text-sm">
          <span className="font-medium">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>

          {selected.size === rows.length && rows.length < count && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={selectAllFiltered}
              disabled={loadingAllIds}
            >
              {loadingAllIds && <Loader2 className="size-3.5 animate-spin" />}
              Seleccionar los {count} registros filtrados
            </Button>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            {canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive">
                    Eliminar
                  </Button>
                }
                title="¿Eliminar los registros seleccionados?"
                description={`Se eliminarán ${selected.size} registro(s). Podrás verlos en el histórico, pero no aparecerán en las listas ni en los totales.`}
                confirmLabel="Eliminar"
                onConfirm={handleBulkDelete}
              />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background text-left text-xs text-muted-foreground shadow-[0_1px_0_0] shadow-border">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todos los visibles"
                />
              </th>
              <th className="px-3 py-2.5">
                <SortLink column="service_number" label="N° servicio" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Nombre</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Ciudad</th>
              <th className="px-3 py-2.5">CEDI</th>
              <th className="px-3 py-2.5">
                <SortLink column="service_date" label="Fecha servicio" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Tipo carga</th>
              <th className="px-3 py-2.5">Conductor</th>
              <th className="px-3 py-2.5">
                <SortLink column="collection_amount" label="Recaudo" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5 text-center">Visitas</th>
              <th className="px-3 py-2.5">Oportunidad</th>
              <th className="px-3 py-2.5">
                <SortLink column="created_at" label="Registrado por" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              {(canEdit || canDelete || canViewAudit) && <th className="px-3 py-2.5 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={15} className="px-3 py-10 text-center text-muted-foreground">
                  No se encontraron recolecciones con los filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggleOne(row.id)}
                    aria-label={`Seleccionar ${row.service_number}`}
                  />
                </td>
                <td className="px-3 py-2.5 font-medium">{row.service_number}</td>
                <td className="px-3 py-2.5">
                  <ResizableCell value={row.client_name ?? "—"} />
                </td>
                <td className="px-3 py-2.5">{row.client?.name ?? "—"}</td>
                <td className="px-3 py-2.5">{row.city?.name ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <ResizableCell value={row.cedi_name ?? "—"} defaultWidth={200} />
                </td>
                <td className="px-3 py-2.5">{formatDate(row.service_date)}</td>
                <td className="px-3 py-2.5">{row.load_type?.name ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <ResizableCell value={row.driver_name ?? "—"} />
                </td>
                <td className="px-3 py-2.5">{formatCurrency(row.collection_amount)}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={row.reconciliation_status} />
                </td>
                <td className="px-3 py-2.5 text-center">
                  {row.visits >= 2 ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{row.visits}</Badge>
                  ) : (
                    <span className="text-muted-foreground">{row.visits}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {row.reconciliation_status === "conciliado" ? (
                    <span className="text-muted-foreground">{computeOpportunityDays(row)} días</span>
                  ) : computeOpportunityDays(row) >= 3 ? (
                    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                      {computeOpportunityDays(row)} días
                    </Badge>
                  ) : (
                    <span className="text-foreground">{computeOpportunityDays(row)} días</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <div>{row.created_by_profile?.full_name ?? "—"}</div>
                  <div className="text-xs">{formatDateTime(row.created_at)}</div>
                </td>
                {(canEdit || canDelete || canViewAudit) && (
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <CollectionFormDialog
                          collection={row}
                          clients={clients}
                          cities={cities}
                          loadTypes={loadTypes}
                          cedis={cedis}
                        />
                      )}
                      {canDelete && (
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="icon-sm" aria-label="Eliminar">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          }
                          title="¿Eliminar esta recolección?"
                          description={`¿Estás seguro de que deseas eliminar el registro ${row.service_number}? Podrás verlo en el histórico, pero no aparecerá en las listas ni en los totales.`}
                          confirmLabel="Eliminar"
                          onConfirm={() => handleDelete(row.id)}
                        />
                      )}
                      {canViewAudit && (
                        <AuditHistoryDialog
                          module="collections"
                          recordId={row.id}
                          recordLabel={row.service_number}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} pageSize={pageSize} count={count} pageSizeOptions={PAGE_SIZE_OPTIONS} />
    </div>
  );
}
