"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import type { AvailabilityRow, AvailabilityFilters, AvailabilityStatus } from "@/lib/availabilities/types";
import type { CatalogOption } from "@/lib/catalog/queries";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  deleteAvailability,
  bulkDeleteAvailabilities,
  getMatchingIds,
} from "@/app/(app)/disponibilidades/actions";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SortLink } from "@/components/data-table/sort-link";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { ResizableCell } from "@/components/data-table/resizable-cell";
import { AvailabilityFormDialog } from "@/components/disponibilidades/availability-form-dialog";
import { StatusChangeDialog } from "@/components/disponibilidades/status-change-dialog";
import { DuplicateButton } from "@/components/disponibilidades/duplicate-button";
import { AuditHistoryDialog } from "@/components/shared/audit-history-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PAGE_SIZE_OPTIONS } from "@/lib/availabilities/types";

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  registrado: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  aprobado: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  autorizado: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
};

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  registrado: "Registrado",
  aprobado: "Aprobado",
  autorizado: "Autorizado",
};

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function AvailabilitiesTable({
  rows,
  count,
  page,
  pageSize,
  sortColumn,
  sortDirection,
  filters,
  canEdit,
  canDelete,
  canApprove,
  canAuthorize,
  canViewAudit,
  clients,
  serviceTypes,
}: {
  rows: AvailabilityRow[];
  count: number;
  page: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  filters: AvailabilityFilters;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canAuthorize: boolean;
  canViewAudit: boolean;
  clients: CatalogOption[];
  serviceTypes: CatalogOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingAllIds, setLoadingAllIds] = useState(false);

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someVisibleSelected = rows.some((r) => selected.has(r.id));
  const selectedIds = Array.from(selected);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
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
    const result = await deleteAvailability(id);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success("Registro eliminado");
  };

  const handleBulkDelete = async () => {
    const result = await bulkDeleteAvailabilities(selectedIds);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.message });
      return;
    }
    toast.success(
      `${result.affected} registro${result.affected === 1 ? "" : "s"} eliminado${result.affected === 1 ? "" : "s"}`,
    );
    clearSelection();
  };

  const showActions = canEdit || canDelete || canViewAudit;
  const canChangeStatus = canApprove || canAuthorize;

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
            {canChangeStatus && (
              <StatusChangeDialog
                trigger={<Button variant="outline" size="sm">Cambiar estado</Button>}
                ids={selectedIds}
                canApprove={canApprove}
                canAuthorize={canAuthorize}
                onDone={clearSelection}
              />
            )}
            {canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" className="text-destructive">
                    Eliminar
                  </Button>
                }
                title="¿Eliminar los registros seleccionados?"
                description={`Se eliminarán ${selected.size} registro(s). Los Autorizados no se eliminan.`}
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
              <th className="px-3 py-2.5">N° orden</th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Coordinador</th>
              <th className="px-3 py-2.5">Tipo de servicio</th>
              <th className="px-3 py-2.5">Quicker</th>
              <th className="px-3 py-2.5">Cédula</th>
              <th className="px-3 py-2.5">
                <SortLink column="date" label="Fecha" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">
                <SortLink column="payment" label="Pago" currentSort={sortColumn} currentDir={sortDirection} />
              </th>
              <th className="px-3 py-2.5">Concepto</th>
              <th className="px-3 py-2.5">Observaciones</th>
              <th className="px-3 py-2.5">Estado</th>
              {showActions && <th className="px-3 py-2.5 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">
                  No se encontraron registros con los filtros aplicados.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isAutorizado = row.status === "autorizado";
              return (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onCheckedChange={() => toggleOne(row.id)}
                      aria-label={`Seleccionar ${row.order_number}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium">{row.order_number}</td>
                  <td className="px-3 py-2.5">{row.client?.name ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <div>{row.created_by_profile?.full_name ?? "—"}</div>
                    <div className="text-xs">{formatDateTime(row.created_at)}</div>
                  </td>
                  <td className="px-3 py-2.5">{row.service_type?.name ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <ResizableCell value={row.quicker_name} />
                  </td>
                  <td className="px-3 py-2.5">{row.cedula}</td>
                  <td className="px-3 py-2.5">{formatDate(row.date)}</td>
                  <td className="px-3 py-2.5">{formatCurrency(row.payment)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ResizableCell value={row.concept ?? "—"} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    <ResizableCell value={row.observation ?? "—"} />
                  </td>
                  <td className="px-3 py-2.5">
                    {canChangeStatus ? (
                      <StatusChangeDialog
                        trigger={
                          <button type="button" className="cursor-pointer">
                            <StatusBadge status={row.status} />
                          </button>
                        }
                        ids={[row.id]}
                        currentStatus={row.status}
                        canApprove={canApprove}
                        canAuthorize={canAuthorize}
                      />
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                  </td>
                  {showActions && (
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canEdit && !isAutorizado && (
                          <AvailabilityFormDialog
                            availability={row}
                            clients={clients}
                            serviceTypes={serviceTypes}
                          />
                        )}
                        {canDelete && !isAutorizado && (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Eliminar">
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            }
                            title="¿Eliminar este registro?"
                            description={`¿Estás seguro de que deseas eliminar la disponibilidad ${row.order_number}?`}
                            confirmLabel="Eliminar"
                            onConfirm={() => handleDelete(row.id)}
                          />
                        )}
                        {canEdit && <DuplicateButton id={row.id} />}
                        {canViewAudit && (
                          <AuditHistoryDialog
                            module="availabilities"
                            recordId={row.id}
                            recordLabel={row.order_number}
                          />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} pageSize={pageSize} count={count} pageSizeOptions={PAGE_SIZE_OPTIONS} />
    </div>
  );
}
