import { Platform } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { useAuthStore } from "store/authStore";

export interface InteraccionUsuarioRow {
  id: string;
  oferta_id: string;
  user_id: string | null;
  visitor_id: string;
  duracion_segundos?: number;
  created_at: string;
  profiles?: {
    id?: string | null;
    nombre?: string | null;
    avatar_url?: string | null;
  } | null;
}

let memoryVisitorId: string | null = null;

/**
 * Obtiene un identificador persistente para el navegador/dispositivo actual.
 * Si el usuario está autenticado, se prefija con `user:<id>` para evitar duplicados.
 */
export function getVisitorKey(userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }
  const STORAGE_KEY = "mg_visitor_id_v1";
  try {
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      let existing = window.localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        existing = `anon:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(STORAGE_KEY, existing);
      }
      return existing;
    }
  } catch {
    // Fallback en memoria si localStorage está bloqueado
  }
  if (!memoryVisitorId) {
    memoryVisitorId = `anon:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return memoryVisitorId;
}

export function useOfertaInteracciones(ofertaId?: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const visitorKey = getVisitorKey(user?.id);

  const likesQuery = useQuery<InteraccionUsuarioRow[]>({
    queryKey: ["oferta_likes", ofertaId],
    enabled: Boolean(ofertaId && isSupabaseConfigured),
    queryFn: async () => {
      if (!ofertaId) return [];
      const { data, error } = await supabase
        .from("oferta_likes")
        .select(
          `
          id,
          oferta_id,
          user_id,
          visitor_id,
          created_at,
          profiles!user_id (
            id,
            nombre,
            avatar_url
          )
        `
        )
        .eq("oferta_id", ofertaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as InteraccionUsuarioRow[];
    },
  });

  const visitasQuery = useQuery<InteraccionUsuarioRow[]>({
    queryKey: ["oferta_visitas", ofertaId],
    enabled: Boolean(ofertaId && isSupabaseConfigured),
    queryFn: async () => {
      if (!ofertaId) return [];
      const { data, error } = await supabase
        .from("oferta_visitas")
        .select(
          `
          id,
          oferta_id,
          user_id,
          visitor_id,
          duracion_segundos,
          created_at,
          profiles!user_id (
            id,
            nombre,
            avatar_url
          )
        `
        )
        .eq("oferta_id", ofertaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as InteraccionUsuarioRow[];
    },
  });

  const likes = likesQuery.data ?? [];
  const visitas = visitasQuery.data ?? [];

  const likedByMe = likes.some(
    (item) =>
      item.visitor_id === visitorKey || (Boolean(user?.id) && item.user_id === user?.id)
  );

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      if (!ofertaId || !isSupabaseConfigured) return;

      if (likedByMe) {
        if (user?.id) {
          await supabase
            .from("oferta_likes")
            .delete()
            .eq("oferta_id", ofertaId)
            .or(`visitor_id.eq.${visitorKey},user_id.eq.${user.id}`);
        } else {
          await supabase
            .from("oferta_likes")
            .delete()
            .eq("oferta_id", ofertaId)
            .eq("visitor_id", visitorKey);
        }
      } else {
        const { error } = await supabase.from("oferta_likes").upsert(
          {
            oferta_id: ofertaId,
            user_id: user?.id ?? null,
            visitor_id: visitorKey,
          },
          { onConflict: "oferta_id,visitor_id" }
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oferta_likes", ofertaId] });
    },
  });

  const registrarVisitaMutation = useMutation({
    mutationFn: async (duracionSegundos: number = 30) => {
      if (!ofertaId || !isSupabaseConfigured || duracionSegundos < 30) return;

      const { error } = await supabase.from("oferta_visitas").upsert(
        {
          oferta_id: ofertaId,
          user_id: user?.id ?? null,
          visitor_id: visitorKey,
          duracion_segundos: Math.max(30, Math.round(duracionSegundos)),
          created_at: new Date().toISOString(),
        },
        { onConflict: "oferta_id,visitor_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oferta_visitas", ofertaId] });
    },
  });

  return {
    likes,
    likesCount: likes.length,
    likedByMe,
    toggleLike: () => toggleLikeMutation.mutate(),
    togglingLike: toggleLikeMutation.isPending,
    visitas,
    visitasCount: visitas.length,
    registrarVisitaValida: (segundos: number = 30) =>
      registrarVisitaMutation.mutate(segundos),
    loadingInteracciones: likesQuery.isLoading || visitasQuery.isLoading,
  };
}
