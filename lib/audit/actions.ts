"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import type { AuditLogRow } from "./types";

/**
 * Historial de cambios de un registro puntual (quién, cuándo, qué cambió).
 * Los triggers de auditoría ya vienen guardando esto desde la Fase 1 en
 * audit_logs; aquí solo se consulta. Requiere el permiso audit.view.
 */
export async function getRecordAuditLogs(module: string, recordId: string): Promise<AuditLogRow[]> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "audit.view")) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, user_id, action, module, record_id, old_data, new_data, created_at, user:profiles(full_name)")
    .eq("module", module)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as AuditLogRow[];
}
