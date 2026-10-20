import { createClient } from "@supabase/supabase-js";

// Sólo se exponen al bundle del cliente las variables EXPO_PUBLIC_* (ver
// node_modules/babel-preset-expo/build/inline-env-vars.js). Cualquier clave
// service_role en este archivo quedaría expuesta en el bundle web.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_MARKERS = ["tu-proyecto", "placeholder", "TU_PROYECTO", "TU_PROYECTO_ID"];

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key-placeholder";

// Si no hay credenciales reales la app puede igual levantarse en modo demo,
// pero contra Supabase no va a responder ninguna query.
export const isSupabaseConfigured =
  Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL) &&
  !PLACEHOLDER_MARKERS.some((marker) => supabaseUrl.includes(marker));

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY reales en .env: " +
      "la app corre en modo demo, sin datos reales."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseClient = typeof supabase;
