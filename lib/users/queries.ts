import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
};

export type PermissionRow = {
  id: string;
  code: string;
  module: string;
  description: string | null;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role_id: string;
  role: { name: string } | null;
};

export const getAllRoles = cache(async (): Promise<RoleRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("id, name, description").order("name");
  return (data ?? []) as RoleRow[];
});

export const getAllPermissions = cache(async (): Promise<PermissionRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("permissions")
    .select("id, code, module, description")
    .order("module")
    .order("code");
  return (data ?? []) as PermissionRow[];
});

/** Ids de permisos que tiene cada rol, agrupados por role_id. */
export const getRolePermissionMap = cache(async (): Promise<Record<string, string[]>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("role_permissions").select("role_id, permission_id");

  const map: Record<string, string[]> = {};
  for (const row of (data ?? []) as { role_id: string; permission_id: string }[]) {
    (map[row.role_id] ??= []).push(row.permission_id);
  }
  return map;
});

export const getAllProfiles = cache(async (): Promise<ProfileRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, role_id, role:roles(name)")
    .order("full_name");
  return (data ?? []) as unknown as ProfileRow[];
});

/**
 * Ciudades asignadas a cada usuario, agrupadas por profile_id. Un usuario
 * sin ninguna fila aquí no tiene restricción de ciudad (ve todo).
 */
export const getProfileCityMap = cache(async (): Promise<Record<string, string[]>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profile_cities").select("profile_id, city_id");

  const map: Record<string, string[]> = {};
  for (const row of (data ?? []) as { profile_id: string; city_id: string }[]) {
    (map[row.profile_id] ??= []).push(row.city_id);
  }
  return map;
});
