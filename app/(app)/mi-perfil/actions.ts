"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/permissions";

export type ActionResult = { success: true } | { success: false; message: string };
export type UploadAvatarResult = { success: true; avatarUrl: string } | { success: false; message: string };

const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
const AVATAR_ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];

function revalidate() {
  // El header muestra nombre/foto en todo el área autenticada.
  revalidatePath("/", "layout");
}

export async function updateMyProfile(fullName: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "No hay sesión activa." };

  const trimmed = fullName.trim();
  if (!trimmed) return { success: false, message: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.userId);

  if (error) return { success: false, message: error.message };

  revalidate();
  return { success: true };
}

export async function uploadMyAvatar(formData: FormData): Promise<UploadAvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "No hay sesión activa." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, message: "Selecciona una imagen." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { success: false, message: "La imagen supera el tamaño máximo permitido (3 MB)." };
  }
  if (!AVATAR_ALLOWED_MIME.includes(file.type)) {
    return { success: false, message: "Formato no permitido. Usa PNG, JPG o WEBP." };
  }

  const supabase = await createClient();
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.userId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    return { success: false, message: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.userId);

  if (updateError) {
    return { success: false, message: updateError.message };
  }

  revalidate();
  return { success: true, avatarUrl };
}
