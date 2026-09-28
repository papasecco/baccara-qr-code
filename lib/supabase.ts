import { createClient } from "@supabase/supabase-js";

// Client lato server con la service_role key: bypassa RLS.
// Va usato SOLO in API routes / server components, mai esposto al browser.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Variabili SUPABASE mancanti (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
