"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Trash2, Download } from "lucide-react";
import {
  getAttachments,
  uploadAttachment,
  deleteAttachment,
  getAttachmentUrl,
  type AttachmentRow,
  type AttachmentFileType,
} from "@/app/(app)/adicionales/actions";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const FILE_TYPE_LABELS: Record<AttachmentFileType, string> = {
  soporte_entregas: "Soporte de entregas",
  autorizacion_cliente: "Autorización del cliente",
};

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsDialog({
  recordId,
  recordLabel,
  canEdit,
}: {
  recordId: string;
  recordLabel: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentRow[] | null>(null);
  const [fileType, setFileType] = useState<AttachmentFileType>("soporte_entregas");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    const data = await getAttachments(recordId);
    setAttachments(data);
    setLoading(false);
  };

  const onOpenChange = async (value: boolean) => {
    setOpen(value);
    if (value) await reload();
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo primero");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);

    setUploading(true);
    const result = await uploadAttachment(recordId, fileType, formData);
    setUploading(false);

    if (!result.success) {
      toast.error("No se pudo adjuntar el archivo", { description: result.message });
      return;
    }

    toast.success("Archivo adjuntado");
    if (fileInputRef.current) fileInputRef.current.value = "";
    await reload();
  };

  const handleDelete = async (id: string) => {
    const result = await deleteAttachment(id);
    if (!result.success) {
      toast.error("No se pudo eliminar el adjunto", { description: result.message });
      return;
    }
    toast.success("Adjunto eliminado");
    await reload();
  };

  const handleDownload = async (storagePath: string) => {
    const url = await getAttachmentUrl(storagePath);
    if (!url) {
      toast.error("No se pudo generar el enlace de descarga");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ver adjuntos" />}>
        <Paperclip className="size-4" />
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adjuntos</DialogTitle>
          <DialogDescription>{recordLabel}</DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="space-y-2 rounded-md border p-3">
            <Label htmlFor="attachment_type">Tipo de adjunto</Label>
            <select
              id="attachment_type"
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              value={fileType}
              onChange={(e) => setFileType(e.target.value as AttachmentFileType)}
            >
              <option value="soporte_entregas">Soporte de entregas</option>
              <option value="autorizacion_cliente">Autorización del cliente</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="w-full text-sm"
            />
            <Button type="button" size="sm" disabled={uploading} onClick={handleUpload} className="gap-1.5">
              {uploading && <Loader2 className="size-3.5 animate-spin" />}
              Adjuntar archivo
            </Button>
            <p className="text-xs text-muted-foreground">PDF, PNG, JPG o WEBP. Máximo 10 MB.</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </div>
        )}

        {!loading && attachments?.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin adjuntos todavía.</p>
        )}

        {!loading && attachments && attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {FILE_TYPE_LABELS[a.file_type as AttachmentFileType] ?? a.file_type} · {formatSize(a.size_bytes)}{" "}
                    · {formatDateTime(a.uploaded_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descargar"
                    onClick={() => handleDownload(a.storage_path)}
                  >
                    <Download className="size-4" />
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Eliminar adjunto"
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
