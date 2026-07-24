"use client";

import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { getRecordAuditLogs } from "@/lib/audit/actions";
import type { AuditLogRow } from "@/lib/audit/types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ACTION_LABELS: Record<string, string> = {
  create: "Creación",
  update: "Edición",
  delete: "Eliminación",
  import: "Importación",
  export: "Exportación",
  status_change: "Cambio de estado",
  restore: "Restauración",
};

// Campos técnicos que no aportan como "cambio" visible para el usuario.
const EXCLUDED_KEYS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "deleted_by",
  "is_active",
]);

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function diffFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changes: { key: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    if (EXCLUDED_KEYS.has(key)) continue;
    const from = oldData[key];
    const to = newData[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ key, from, to });
  }
  return changes;
}

export function AuditHistoryDialog({
  module,
  recordId,
  recordLabel,
}: {
  module: string;
  recordId: string;
  recordLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogRow[] | null>(null);

  const onOpenChange = async (value: boolean) => {
    setOpen(value);
    if (value && logs === null) {
      setLoading(true);
      const data = await getRecordAuditLogs(module, recordId);
      setLogs(data);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ver historial de cambios" />}>
        <History className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial de cambios</DialogTitle>
          <DialogDescription>{recordLabel}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </div>
        )}

        {!loading && logs?.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin cambios registrados todavía.</p>
        )}

        {!loading && logs && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => {
              const changes = diffFields(log.old_data, log.new_data);
              return (
                <div key={log.id} className="rounded-md border p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-medium">{ACTION_LABELS[log.action] ?? log.action}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">{log.user?.full_name ?? "Sistema"}</p>
                  {changes.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {changes.map((change) => (
                        <li key={change.key}>
                          <span className="font-medium">{humanizeKey(change.key)}:</span>{" "}
                          <span className="text-muted-foreground line-through">{formatValue(change.from)}</span>{" "}
                          → <span>{formatValue(change.to)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
