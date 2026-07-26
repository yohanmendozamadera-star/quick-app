"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, can } from "@/lib/permissions";

export type ActionResult = { success: true } | { success: false; message: string };

function revalidate() {
  revalidatePath("/configuraciones");
}

async function requireUsersManage() {
  const user = await getCurrentUser();
  if (!user || !can(user.permissions, "users.manage")) return null;
  return user;
}

// ---------- Roles ----------

export async function createRole(name: string, description: string): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar roles." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: "El nombre del rol es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase.from("roles").insert({ name: trimmed, description: description.trim() || null });

  if (error) {
    const message = error.code === "23505" ? "Ya existe un rol con ese nombre." : error.message;
    return { success: false, message };
  }

  revalidate();
  return { success: true };
}

export async function updateRole(id: string, name: string, description: string): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar roles." };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, message: "El nombre del rol es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .update({ name: trimmed, description: description.trim() || null })
    .eq("id", id);

  if (error) {
    const message = error.code === "23505" ? "Ya existe un rol con ese nombre." : error.message;
    return { success: false, message };
  }

  revalidate();
  return { success: true };
}

/** Reemplaza el conjunto completo de permisos de un rol por el enviado. */
export async function setRolePermissions(roleId: string, permissionIds: string[]): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar roles." };

  const supabase = await createClient();

  const { error: deleteError } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
  if (deleteError) return { success: false, message: deleteError.message };

  if (permissionIds.length > 0) {
    const { error: insertError } = await supabase
      .from("role_permissions")
      .insert(permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })));
    if (insertError) return { success: false, message: insertError.message };
  }

  revalidate();
  return { success: true };
}

// ---------- Usuarios ----------

export async function createUserAccount(input: {
  fullName: string;
  email: string;
  password: string;
  roleId: string;
  cityIds?: string[];
}): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar usuarios." };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();

  if (!fullName) return { success: false, message: "El nombre es obligatorio." };
  if (!email) return { success: false, message: "El correo es obligatorio." };
  if (input.password.length < 8) return { success: false, message: "La contraseña debe tener al menos 8 caracteres." };
  if (!input.roleId) return { success: false, message: "El rol es obligatorio." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    return { success: false, message: error?.message ?? "No se pudo crear el usuario." };
  }

  // El trigger fn_handle_new_user ya creó el perfil con el rol "Consulta"
  // por defecto; aquí se ajusta al rol elegido en el formulario.
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role_id: input.roleId })
    .eq("id", data.user.id);

  if (profileError) {
    return { success: false, message: profileError.message };
  }

  if (input.cityIds?.length) {
    const { error: citiesError } = await supabase
      .from("profile_cities")
      .insert(input.cityIds.map((cityId) => ({ profile_id: data.user.id, city_id: cityId })));
    if (citiesError) {
      return { success: false, message: citiesError.message };
    }
  }

  revalidate();
  return { success: true };
}

/** Reemplaza el conjunto completo de ciudades asignadas a un usuario. Vacío = sin restricción (ve todo). */
export async function setUserCities(userId: string, cityIds: string[]): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar usuarios." };

  const supabase = await createClient();

  const { error: deleteError } = await supabase.from("profile_cities").delete().eq("profile_id", userId);
  if (deleteError) return { success: false, message: deleteError.message };

  if (cityIds.length > 0) {
    const { error: insertError } = await supabase
      .from("profile_cities")
      .insert(cityIds.map((cityId) => ({ profile_id: userId, city_id: cityId })));
    if (insertError) return { success: false, message: insertError.message };
  }

  revalidate();
  return { success: true };
}

export async function updateUserRole(userId: string, roleId: string): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar usuarios." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role_id: roleId }).eq("id", userId);

  if (error) return { success: false, message: error.message };

  revalidate();
  return { success: true };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar usuarios." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);

  if (error) return { success: false, message: error.message };

  revalidate();
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<ActionResult> {
  const user = await requireUsersManage();
  if (!user) return { success: false, message: "No tienes permiso para administrar usuarios." };
  if (newPassword.length < 8) return { success: false, message: "La contraseña debe tener al menos 8 caracteres." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });

  if (error) return { success: false, message: error.message };

  return { success: true };
}
