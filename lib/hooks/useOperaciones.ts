import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";
import { OFERTA_MEDIA_SELECT } from "./useOfferDB";

export interface Operacion {
  id: string;
  oferta_id: string;
  vendedor_id: string;
  comprador_id: string;
  precio: number;
  tipo_precio: string;
  cantidad: number;
  categoria: string;
  raza?: string | null;
  localidad?: string | null;
  provincia: string;
  comprador_nombre?: string | null;
  comprador_telefono?: string | null;
  comprador_email?: string | null;
  vendedor_nombre?: string | null;
  vendedor_telefono?: string | null;
  vendedor_email?: string | null;
  vendedor_establecimiento?: string | null;
  estado: string;
  created_at: string;
  ofertas?: {
    id: string;
    categoria: string;
    raza?: string | null;
    cantidad: number;
    precio: number;
    tipo_precio: string;
    peso_promedio?: number | null;
    provincia: string;
    localidad?: string | null;
    estado: string;
    oferta_media?: OfertaMediaRow[];
  } | null;
}

export function useMisOperaciones(userId?: string) {
  return useQuery({
    queryKey: ["mis_operaciones", userId],
    queryFn: async () => {
      if (!userId) return { ventas: [], compras: [], todas: [] };

      const { data, error } = await supabase
        .from("operaciones")
        .select(`
          *,
          ofertas:oferta_id (
            id,
            categoria,
            raza,
            cantidad,
            precio,
            tipo_precio,
            peso_promedio,
            provincia,
            localidad,
            estado,
            oferta_media (${OFERTA_MEDIA_SELECT})
          )
        `)
        .or(`vendedor_id.eq.${userId},comprador_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const todas = (data ?? []) as Operacion[];
      const ventas = todas.filter((op) => op.vendedor_id === userId);
      const compras = todas.filter((op) => op.comprador_id === userId);

      return {
        todas,
        ventas,
        compras,
      };
    },
    enabled: Boolean(userId) && isSupabaseConfigured,
    refetchInterval: 30000,
  });
}
