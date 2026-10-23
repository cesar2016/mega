import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { maskNombreUsuario } from "lib/utils";
import { useAuthStore } from "store/authStore";

/** Campos de media que se embeben en las consultas de ofertas. */
export const OFERTA_MEDIA_SELECT = `
  id,
  tipo,
  url,
  orden,
  es_portada,
  duracion_segundos
`;

function sanitizarOferta<T extends Record<string, any>>(oferta: T): T {
  if (!oferta?.profiles) return oferta;
  const miId = useAuthStore.getState().user?.id;
  const esPropia = Boolean(
    miId && (oferta.productor_id === miId || oferta.profiles.id === miId)
  );
  return {
    ...oferta,
    profiles: {
      id: oferta.profiles.id ?? null,
      nombre: maskNombreUsuario(oferta.profiles.nombre, "Usu****", esPropia),
      avatar_url: null,
      rol: oferta.profiles.rol ?? null,
    },
  };
}

export function useOfertasActivas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["ofertas_activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ofertas")
        .select(`
          *,
          profiles (id, nombre, rol),
          oferta_media (${OFERTA_MEDIA_SELECT})
        `)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(sanitizarOferta);
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
          profiles (id, nombre, rol),
          oferta_media (${OFERTA_MEDIA_SELECT})
        `)
        .eq("productor_id", productorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(sanitizarOferta);
    },
    enabled: !!productorId && isSupabaseConfigured,
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
          profiles (id, nombre, rol),
          oferta_media (${OFERTA_MEDIA_SELECT})
        `)
        .eq("id", ofertaId)
        .single();

      if (error) throw error;
      return data ? sanitizarOferta(data) : data;
    },
    enabled: !!ofertaId && isSupabaseConfigured,
  });
}

/** Extrae el path interno del bucket `oferta_media` a partir de una URL pública. */
export function storagePathFromPublicUrl(url?: string | null): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/oferta_media/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0].split("#")[0];
  return path ? decodeURIComponent(path) : null;
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

export async function updateOferta(id: string, data: Record<string, any>) {
  const { error } = await supabase
    .from("ofertas")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Elimina una oferta y limpia de manera best-effort sus archivos en Storage.
 * Las filas de `oferta_media`, `matches` y `solicitudes_flete` se eliminan en
 * cascada por la base de datos (`ON DELETE CASCADE`).
 */
export async function deleteOferta(id: string, mediaUrls?: (string | null | undefined)[]) {
  let urls = mediaUrls;

  if (!urls) {
    const { data: mediaRows } = await supabase
      .from("oferta_media")
      .select("url")
      .eq("oferta_id", id);
    urls = (mediaRows ?? []).map((r: { url?: string | null }) => r.url);
  }

  const { error } = await supabase.from("ofertas").delete().eq("id", id);
  if (error) throw error;

  const paths = (urls ?? [])
    .map((u) => storagePathFromPublicUrl(u))
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    await supabase.storage
      .from("oferta_media")
      .remove(paths)
      .catch(() => {});
  }
}

