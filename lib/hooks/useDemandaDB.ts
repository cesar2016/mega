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
export function useDemandasPorComprador(compradorId: string) {
  return useQuery({
    queryKey: ["demandas_comprador", compradorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select(`
          *,
          profiles (nombre)
        `)
        .eq("comprador_id", compradorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(sanitizarDemanda);
    },
    enabled: !!compradorId,
  });
}
