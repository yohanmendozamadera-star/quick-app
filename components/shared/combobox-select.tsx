"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = { id: string; name: string };

/**
 * Select con búsqueda que además permite crear un valor nuevo al vuelo
 * cuando lo que se escribe no existe en la lista (Coordinador, CENLOG, etc.).
 * La lista visible se completa con lo que el propio usuario va creando en la
 * sesión, sin esperar a recargar la página.
 */
export function ComboboxSelect({
  value,
  onChange,
  options,
  onOptionCreated,
  onCreate,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar o escribir para crear…",
  disabled,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  options: ComboboxOption[];
  onOptionCreated?: (option: ComboboxOption) => void;
  onCreate?: (name: string) => Promise<{ success: true; option: ComboboxOption } | { success: false; message: string }>;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [extraOptions, setExtraOptions] = useState<ComboboxOption[]>([]);
  const [creating, setCreating] = useState(false);

  const allOptions = [...options, ...extraOptions.filter((e) => !options.some((o) => o.id === e.id))];
  const selected = allOptions.find((o) => o.id === value);

  const handleCreate = async () => {
    const name = search.trim();
    if (!name || !onCreate) return;
    setCreating(true);
    const result = await onCreate(name);
    setCreating(false);

    if (!result.success) {
      return;
    }
    setExtraOptions((prev) => [...prev, result.option]);
    onOptionCreated?.(result.option);
    onChange(result.option.id);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[--anchor-width] p-0">
        <Command>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>
              {onCreate && search.trim() ? (
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Crear &ldquo;{search.trim()}&rdquo;
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">Sin resultados.</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {allOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", option.id === value ? "opacity-100" : "opacity-0")} />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
