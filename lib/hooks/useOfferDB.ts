import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";

/** Campos de media que se embeben en las consultas de ofertas. */
export const OFERTA_MEDIA_SELECT = `
  id,
  tipo,
  url,
  orden,
  es_portada,
  duracion_segundos
`;

export function useOfertasActivas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["ofertas_activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ofertas")
        .select(`
          *,
          profiles (id, nombre, avatar_url, rol),
          oferta_media (${OFERTA_MEDIA_SELECT})
        `)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    // Sin credenciales reales no hay a quién preguntar: la app queda en modo demo.
    enabled: (options?.enabled ?? true) && isSupabaseConfigured,
    retry: isSupabaseConfigured ? 3 : false,
    refetchInterval: 60000, // Refrescar cada minuto
  });
}

export function useOfertasPorProductor(productorId: string) {
  return useQuery({
    queryKey: ["ofertas_productor", productorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ofertas")
        .select(`
          *,
          profiles (nombre, avatar_url),
          oferta_media (${OFERTA_MEDIA_SELECT})
        `)
        .eq("productor_id", productorId)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!productorId,
  });
}

/** Detalle de una oferta: datos + media (fotos y videos). */
export function useOfertaById(ofertaId: string) {
  return useQuery({
    queryKey: ["oferta", ofertaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ofertas")
        .select(`
          *,
          profiles (id, nombre, avatar_url, rol),
          oferta_media (${OFERTA_MEDIA_SELECT})
        `)
        .eq("id", ofertaId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!ofertaId,
  });
}

export async function insertOferta(data: any): Promise<string | null> {
  const { data: inserted, error } = await supabase
    .from("ofertas")
    .insert({
      ...data,
      vigencia: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      estado: "activa",
    })
    .select()
    .single();

  if (error) throw error;
  return inserted?.id ?? null;
}

export async function updateOferta(id: string, data: any) {
  const { error } = await supabase
    .from("ofertas")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}
