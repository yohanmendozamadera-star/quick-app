"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setCediActive } from "@/app/(app)/configuraciones/actions";
import type { CediOption, CatalogOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CediFormDialog } from "@/components/configuraciones/cedi-form-dialog";
import { CedisBulkImportDialog } from "@/components/configuraciones/cedis-bulk-import-dialog";

type CediWithStatus = CediOption & { is_active: boolean };

export function CedisManager({ cedis, cities }: { cedis: CediWithStatus[]; cities: CatalogOption[] }) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const term = search.trim().toLocaleLowerCase("es-CO");
  const visible = cedis
    .filter((c) => showInactive || c.is_active)
    .filter(
      (c) =>
        !term ||
        c.code.toLocaleLowerCase("es-CO").includes(term) ||
        c.name.toLocaleLowerCase("es-CO").includes(term) ||
        c.city?.name.toLocaleLowerCase("es-CO").includes(term),
    );

  const handleToggleActive = async (cedi: CediWithStatus) => {
    setSavingId(cedi.id);
    const result = await setCediActive(cedi.id, !cedi.is_active);
    setSavingId(null);

    if (!result.success) {
      toast.error("No se pudo actualizar", { description: result.message });
      return;
    }
    toast.success(cedi.is_active ? "Droguería desactivada" : "Droguería activada");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por código, nombre o ciudad…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <CediFormDialog cities={cities} />
        <CedisBulkImportDialog cities={cities} />

        <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(Boolean(v))} />
          Mostrar inactivas
        </label>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Ciudad</th>
                <th className="px-3 py-2.5">Droguería</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    Sin droguerías registradas todavía.
                  </td>
                </tr>
              )}
              {visible.map((cedi) => (
                <tr key={cedi.id} className={cedi.is_active ? "" : "opacity-50"}>
                  <td className="px-3 py-2 font-medium">{cedi.code}</td>
                  <td className="px-3 py-2">{cedi.city?.name ?? "—"}</td>
                  <td className="px-3 py-2">{cedi.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <CediFormDialog cedi={cedi} cities={cities} />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={savingId === cedi.id}
                        onClick={() => handleToggleActive(cedi)}
                      >
                        {cedi.is_active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
