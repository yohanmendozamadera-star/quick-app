import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave secreta (service role). Solo para usarse en Server
 * Actions / Route Handlers que necesiten saltar RLS a propósito (ej. tareas
 * administrativas). Nunca importar este archivo desde un componente cliente.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
