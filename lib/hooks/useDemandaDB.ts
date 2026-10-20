import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";

/** Demandas de compra activas (compradores). */
export function useDemandasActivas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["demandas_activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select(`
          *,
          profiles (id, nombre, avatar_url, rol)
        `)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: (options?.enabled ?? true) && isSupabaseConfigured,
    retry: isSupabaseConfigured ? 3 : false,
    refetchInterval: 60000,
  });
}

/** Demandas publicadas por un comprador. */
export function useDemandasPorComprador(compradorId: string) {
  return useQuery({
    queryKey: ["demandas_comprador", compradorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandas")
        .select(`
          *,
          profiles (nombre, avatar_url)
        `)
        .eq("comprador_id", compradorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!compradorId,
  });
}
