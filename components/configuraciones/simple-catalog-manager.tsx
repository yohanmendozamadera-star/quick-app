"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Check, X } from "lucide-react";
import {
  createSimpleCatalogItem,
  updateSimpleCatalogItem,
  setSimpleCatalogItemActive,
  type SimpleCatalogTable,
} from "@/app/(app)/configuraciones/actions";
import type { CatalogOption } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type ItemWithStatus = CatalogOption & { is_active: boolean };

/**
 * Alta/edición/activación de un catálogo simple (solo nombre + activo):
 * Ciudades, Coordinadores, CENLOG, Tipos de transporte, Descripciones de
 * cobro. Un mismo componente sirve para los cinco, solo cambia la tabla.
 */
export function SimpleCatalogManager({
  table,
  items,
  itemLabel,
}: {
  table: SimpleCatalogTable;
  items: ItemWithStatus[];
  itemLabel: string;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const visibleItems = showInactive ? items : items.filter((i) => i.is_active);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createSimpleCatalogItem(table, newName.trim());
    setCreating(false);

    if (!result.success) {
      toast.error("No se pudo crear", { description: result.message });
      return;
    }
    toast.success(`${itemLabel} agregado`);
    setNewName("");
  };

  const startEdit = (item: ItemWithStatus) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    setSavingId(id);
    const result = await updateSimpleCatalogItem(table, id, editingName.trim());
    setSavingId(null);

    if (!result.success) {
      toast.error("No se pudo guardar", { description: result.message });
      return;
    }
    toast.success("Guardado");
    setEditingId(null);
  };

  const handleToggleActive = async (item: ItemWithStatus) => {
    setSavingId(item.id);
    const result = await setSimpleCatalogItemActive(table, item.id, !item.is_active);
    setSavingId(null);

    if (!result.success) {
      toast.error("No se pudo actualizar", { description: result.message });
      return;
    }
    toast.success(item.is_active ? `${itemLabel} desactivado` : `${itemLabel} activado`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder={`Nuevo ${itemLabel.toLowerCase()}…`}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          className="max-w-xs"
        />
        <Button type="button" size="sm" className="gap-1.5" disabled={creating || !newName.trim()} onClick={handleCreate}>
          {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Agregar
        </Button>

        <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(Boolean(v))} />
          Mostrar inactivos
        </label>
      </div>

      <div className="rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2.5">Nombre</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">
                  Sin registros todavía.
                </td>
              </tr>
            )}
            {visibleItems.map((item) => (
              <tr key={item.id} className={item.is_active ? "" : "opacity-50"}>
                <td className="px-3 py-2">
                  {editingId === item.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSaveEdit(item.id);
                        }
                      }}
                      className="h-8"
                      autoFocus
                    />
                  ) : (
                    item.name
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {editingId === item.id ? (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Guardar"
                          disabled={savingId === item.id}
                          onClick={() => handleSaveEdit(item.id)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Cancelar"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar"
                          onClick={() => startEdit(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={savingId === item.id}
                          onClick={() => handleToggleActive(item)}
                        >
                          {item.is_active ? "Desactivar" : "Activar"}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
