import { createClient } from "@supabase/supabase-js";

// Next cachea los fetch GET por defecto. En un panel que debe reflejar lo que
// acaba de escribir n8n eso provoca datos viejos, así que se desactiva siempre.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

// Se usa solo en Server Components: la clave nunca viaja al navegador.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY (ver .env.local.example)");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  });
}
