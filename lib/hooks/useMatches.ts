import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { OFERTA_MEDIA_SELECT } from "lib/hooks/useOfferDB";
import type { DemandaMatch, OfertaMatch } from "lib/matching";

export type EstadoMatch = "pendiente" | "aceptado" | "rechazado" | "finalizado";

export type MatchRow = {
  id: string;
  oferta_id: string;
  demanda_id: string;
  puntaje: number;
  estado: EstadoMatch;
  creado_en?: string | null;
  ofertas: OfertaMatch | null;
  demandas: DemandaMatch | null;
};

const MATCH_SELECT = `
  id,
  oferta_id,
  demanda_id,
  puntaje,
  estado,
  creado_en,
  ofertas (
    id,
    productor_id,
    categoria,
    raza,
    cantidad,
    peso_promedio,
    precio,
    tipo_precio,
    ubicacion,
    provincia,
    localidad,
    estado,
    profiles (id, nombre, avatar_url, rol),
    oferta_media (${OFERTA_MEDIA_SELECT})
  ),
  demandas (
    id,
    comprador_id,
    categoria,
    raza,
    cantidad_min,
    cantidad_max,
    peso_min_kg,
    peso_max_kg,
    precio_max,
    tipo_precio,
    ubicacion,
    provincia,
    localidad,
    radio_km,
    estado,
    profiles (id, nombre, avatar_url, rol)
  )
`;

/**
 * Cruces del usuario actual: los lotes que matchean con sus demandas y las
 * demandas que matchean con sus lotes. La RLS de `matches` ya filtra por parte.
 */
export function useMatches(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(MATCH_SELECT)
        .order("puntaje", { ascending: false })
        .order("creado_en", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
    enabled: (options?.enabled ?? true) && isSupabaseConfigured,
    retry: isSupabaseConfigured ? 3 : false,
    refetchInterval: 60000,
  });
}

/** Acepta o descarta un match. La RLS permite sólo cambiar `estado`. */
export async function actualizarEstadoMatch(id: string, estado: EstadoMatch) {
  const { error } = await supabase.from("matches").update({ estado }).eq("id", id);
  if (error) throw error;
}

/** Cuántos cruces tiene el usuario sin responder (para el badge de navegación). */
export function usePendientesMatch(options?: { enabled?: boolean }) {
  const { data } = useMatches(options);
  return (data ?? []).filter((match) => match.estado === "pendiente").length;
}
