"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/permissions";
import {
  manualAdjustmentFormSchema,
  normalizeManualAdjustmentInput,
} from "@/lib/validations/manual-adjustment";

export type ActionResult = { success: true } | { success: false; message: string };

export async function createManualAdjustment(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "dashboard.adjust")) {
    return { success: false, message: "No tienes permiso para agregar ajustes manuales." };
  }

  const parsed = manualAdjustmentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_manual_adjustments")
    .insert(normalizeManualAdjustmentInput(parsed.data));

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
