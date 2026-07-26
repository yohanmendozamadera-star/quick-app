"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { duplicateAvailability } from "@/app/(app)/disponibilidades/actions";
import { Button } from "@/components/ui/button";

export function DuplicateButton({ id }: { id: string }) {
  const [submitting, setSubmitting] = useState(false);

  const handleClick = async () => {
    setSubmitting(true);
    const result = await duplicateAvailability(id);
    setSubmitting(false);

    if (!result.success) {
      toast.error("No se pudo duplicar", { description: result.message });
      return;
    }
    toast.success("Registro duplicado", { description: "La copia quedó con fecha de hoy y un nuevo número de orden." });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Duplicar"
      disabled={submitting}
      onClick={handleClick}
    >
      {submitting ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
    </Button>
  );
}
