import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { maskNombreUsuario } from "lib/utils";
import { useAuthStore } from "store/authStore";

function sanitizarDemanda<T extends Record<string, any>>(demanda: T): T {
  if (!demanda?.profiles) return demanda;
  const miId = useAuthStore.getState().user?.id;
  const esPropia = Boolean(
    miId && (demanda.comprador_id === miId || demanda.profiles.id === miId)
  );
  return {
    ...demanda,
    profiles: {
      id: demanda.profiles.id ?? null,
      nombre: maskNombreUsuario(demanda.profiles.nombre, "Usu****", esPropia),
      avatar_url: null,
      rol: demanda.profiles.rol ?? null,
    },
  };
}

/** Demandas de compra activas. */
export function useDemandasActivas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["demandas_activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select(`
          *,
          profiles (id, nombre, rol)
        `)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(sanitizarDemanda);
    },
    enabled: (options?.enabled ?? true) && isSupabaseConfigured,
    retry: isSupabaseConfigured ? 3 : false,
    refetchInterval: 60000,
  });
}

/** Demandas publicadas por un usuario. */
export function useDemandasPorComprador(compradorId?: string | null) {
  return useQuery({
    queryKey: ["demandas_comprador", compradorId],
    queryFn: async () => {
      if (!compradorId) return [];
      const { data, error } = await supabase
        .from("demandas")
        .select(`
          *,
          profiles (id, nombre, rol)
        `)
        .eq("comprador_id", compradorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(sanitizarDemanda);
    },
    enabled: !!compradorId && isSupabaseConfigured,
  });
}

export type NuevaDemandaPayload = {
  comprador_id: string;
  categoria: string;
  raza?: string | null;
  cantidad_min?: number | null;
  cantidad_max?: number | null;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
  precio_max?: number | null;
  tipo_precio?: "por_kilo" | "por_cabeza" | "a_convenir";
  provincia: string;
  localidad?: string | null;
  radio_km?: number | null;
  ubicacion?: string | null;
};

/**
 * Inserta una nueva búsqueda/demanda de compra en Supabase.
 * El trigger de base de datos calculará inmediatamente los cruces con
 * las ofertas existentes e insertará en la tabla `matches`.
 */
export async function insertDemanda(payload: NuevaDemandaPayload): Promise<{ id: string; matchesCount: number }> {
  const { data, error } = await supabase
    .from("demandas")
    .insert({
      comprador_id: payload.comprador_id,
      categoria: payload.categoria,
      raza: payload.raza?.trim() || null,
      cantidad_min: payload.cantidad_min ?? null,
      cantidad_max: payload.cantidad_max ?? null,
      peso_min_kg: payload.peso_min_kg ?? null,
      peso_max_kg: payload.peso_max_kg ?? null,
      precio_max: payload.precio_max ?? null,
      tipo_precio: payload.tipo_precio ?? "por_kilo",
      provincia: payload.provincia.trim(),
      localidad: payload.localidad?.trim() || null,
      radio_km: payload.radio_km ?? 150,
      ubicacion: payload.ubicacion ?? null,
      estado: "activa",
      vigencia: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  // Consultar cuántos matches automáticos generó de inmediato la base de datos
  let matchesCount = 0;
  try {
    const { count } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("demanda_id", data.id);
    matchesCount = count ?? 0;
  } catch (_e) {
    // Si la lectura rápida falla, no bloqueamos la inserción exitosa
  }

  return { id: data.id, matchesCount };
}

/** Cancela (pausa) una demanda activa. */
export async function cancelarDemanda(id: string) {
  const { error } = await supabase
    .from("demandas")
    .update({ estado: "cancelada", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/** Reactiva una demanda previamente cancelada. */
export async function reactivarDemanda(id: string) {
  const { error } = await supabase
    .from("demandas")
    .update({ estado: "activa", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

