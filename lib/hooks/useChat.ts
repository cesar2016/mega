import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { detectarDatosContacto } from "lib/contactFilter";
import { maskNombreUsuario } from "lib/utils";
import { useAuthStore } from "store/authStore";

export type MensajeRow = {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  cuerpo: string;
  creado_en: string;
};

export type ConversacionResumen = {
  id: string;
  oferta_id: string | null;
  demanda_id: string | null;
  participante_1: string;
  participante_2: string;
  ultimo_mensaje_en: string | null;
  creado_en: string | null;
  contraparte_id: string;
  contraparte_alias: string;
  ultimo_mensaje?: {
    cuerpo: string;
    creado_en: string;
    remitente_id: string;
  } | null;
  ofertas?: {
    id: string;
    categoria: string;
    raza?: string | null;
    cantidad: number;
    precio: number;
    tipo_precio?: string | null;
    provincia?: string | null;
    localidad?: string | null;
  } | null;
  demandas?: {
    id: string;
    categoria: string;
    raza?: string | null;
    cantidad_min?: number | null;
    cantidad_max?: number | null;
    provincia?: string | null;
    localidad?: string | null;
  } | null;
};

export type BorradorConsulta = {
  oferta_id: string | null;
  demanda_id: string | null;
  contraparte_id: string;
  contraparte_alias: string;
  ofertas?: ConversacionResumen["ofertas"];
  demandas?: ConversacionResumen["demandas"];
};

/**
 * Lista las conversaciones activas del usuario actual (solo aquellas donde ya
 * se envió al menos un mensaje) con el alias semi-encriptado de la contraparte
 * (ej. `Ces****`) y el contexto del lote o demanda.
 */
export function useConversaciones(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return;

    const channel = supabase
      .channel(`conversaciones-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversaciones" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversaciones"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversaciones"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return useQuery({
    queryKey: ["conversaciones", userId],
    queryFn: async (): Promise<ConversacionResumen[]> => {
      if (!userId) return [];

      const { data: convs, error } = await supabase
        .from("conversaciones")
        .select(`
          id,
          oferta_id,
          demanda_id,
          participante_1,
          participante_2,
          ultimo_mensaje_en,
          creado_en,
          ofertas (
            id,
            categoria,
            raza,
            cantidad,
            precio,
            tipo_precio,
            provincia,
            localidad
          ),
          demandas (
            id,
            categoria,
            raza,
            cantidad_min,
            cantidad_max,
            provincia,
            localidad
          )
        `)
        .or(`participante_1.eq.${userId},participante_2.eq.${userId}`)
        .order("ultimo_mensaje_en", { ascending: false });

      if (error) throw error;
      const filas = (convs ?? []) as any[];
      if (filas.length === 0) return [];

      const convIds = filas.map((c) => c.id);

      const { data: ultimosData } = await supabase
        .from("mensajes")
        .select("conversacion_id, cuerpo, creado_en, remitente_id")
        .in("conversacion_id", convIds)
        .order("creado_en", { ascending: false });

      const ultimoPorConv = new Map<
        string,
        { cuerpo: string; creado_en: string; remitente_id: string }
      >();
      for (const m of (ultimosData ?? []) as {
        conversacion_id: string;
        cuerpo: string;
        creado_en: string;
        remitente_id: string;
      }[]) {
        if (!ultimoPorConv.has(m.conversacion_id)) {
          ultimoPorConv.set(m.conversacion_id, {
            cuerpo: m.cuerpo,
            creado_en: m.creado_en,
            remitente_id: m.remitente_id,
          });
        }
      }

      // Solo considerar conversaciones donde efectivamente se haya iniciado la charla
      const filasConMensajes = filas.filter((c) => ultimoPorConv.has(c.id));
      if (filasConMensajes.length === 0) return [];

      const contraparteIds = Array.from(
        new Set(
          filasConMensajes.map((c) =>
            c.participante_1 === userId ? c.participante_2 : c.participante_1
          )
        )
      );

      const { data: perfilesData } = await supabase
        .from("profiles")
        .select("id, nombre")
        .in("id", contraparteIds);

      const aliasPorId = new Map<string, string>();
      for (const p of (perfilesData ?? []) as { id: string; nombre?: string | null }[]) {
        aliasPorId.set(p.id, maskNombreUsuario(p.nombre));
      }

      return filasConMensajes.map((c) => {
        const contraparteId =
          c.participante_1 === userId ? c.participante_2 : c.participante_1;
        return {
          ...c,
          contraparte_id: contraparteId,
          contraparte_alias: aliasPorId.get(contraparteId) ?? "Usu****",
          ultimo_mensaje: ultimoPorConv.get(c.id) ?? null,
        } as ConversacionResumen;
      });
    },
    enabled: Boolean(userId) && (options?.enabled ?? true) && isSupabaseConfigured,
    refetchInterval: 15000,
  });
}

/**
 * Carga los datos de contexto de una oferta o demanda para mostrar la ventana
 * de nueva consulta sin crear la conversación en la base hasta enviar el primer mensaje.
 */
export function useBorradorConsulta(params: {
  conversacionId?: string | null;
  ofertaId?: string | null;
  demandaId?: string | null;
  enabled?: boolean;
}) {
  const userId = useAuthStore((state) => state.user?.id);
  const conversacionId = params.conversacionId ? String(params.conversacionId) : null;
  const ofertaId = params.ofertaId ? String(params.ofertaId) : null;
  const demandaId = params.demandaId ? String(params.demandaId) : null;

  return useQuery({
    queryKey: ["borrador_consulta", userId, conversacionId, ofertaId, demandaId],
    queryFn: async (): Promise<BorradorConsulta | null> => {
      if (!userId) return null;

      let targetOfertaId = ofertaId;
      let targetDemandaId = demandaId;

      if (!targetOfertaId && !targetDemandaId && conversacionId) {
        const { data: conv } = await supabase
          .from("conversaciones")
          .select("oferta_id, demanda_id")
          .eq("id", conversacionId)
          .maybeSingle();
        if (conv) {
          targetOfertaId = (conv as any).oferta_id ?? null;
          targetDemandaId = (conv as any).demanda_id ?? null;
        }
      }

      if (targetOfertaId) {
        const { data: oferta, error } = await supabase
          .from("ofertas")
          .select(`
            id,
            productor_id,
            categoria,
            raza,
            cantidad,
            precio,
            tipo_precio,
            provincia,
            localidad,
            profiles (
              id,
              nombre
            )
          `)
          .eq("id", targetOfertaId)
          .maybeSingle();

        if (error || !oferta) return null;
        const perfil = Array.isArray((oferta as any).profiles)
          ? (oferta as any).profiles[0]
          : (oferta as any).profiles;
        const contraparteId = (oferta as any).productor_id ?? perfil?.id;
        if (!contraparteId || contraparteId === userId) return null;

        return {
          oferta_id: (oferta as any).id,
          demanda_id: null,
          contraparte_id: contraparteId,
          contraparte_alias: maskNombreUsuario(perfil?.nombre),
          ofertas: {
            id: (oferta as any).id,
            categoria: (oferta as any).categoria,
            raza: (oferta as any).raza,
            cantidad: (oferta as any).cantidad,
            precio: (oferta as any).precio,
            tipo_precio: (oferta as any).tipo_precio,
            provincia: (oferta as any).provincia,
            localidad: (oferta as any).localidad,
          },
          demandas: null,
        };
      }

      if (targetDemandaId) {
        const { data: demanda, error } = await supabase
          .from("demandas")
          .select(`
            id,
            comprador_id,
            categoria,
            raza,
            cantidad_min,
            cantidad_max,
            provincia,
            localidad,
            profiles (
              id,
              nombre
            )
          `)
          .eq("id", targetDemandaId)
          .maybeSingle();

        if (error || !demanda) return null;
        const perfil = Array.isArray((demanda as any).profiles)
          ? (demanda as any).profiles[0]
          : (demanda as any).profiles;
        const contraparteId = (demanda as any).comprador_id ?? perfil?.id;
        if (!contraparteId || contraparteId === userId) return null;

        return {
          oferta_id: null,
          demanda_id: (demanda as any).id,
          contraparte_id: contraparteId,
          contraparte_alias: maskNombreUsuario(perfil?.nombre),
          ofertas: null,
          demandas: {
            id: (demanda as any).id,
            categoria: (demanda as any).categoria,
            raza: (demanda as any).raza,
            cantidad_min: (demanda as any).cantidad_min,
            cantidad_max: (demanda as any).cantidad_max,
            provincia: (demanda as any).provincia,
            localidad: (demanda as any).localidad,
          },
        };
      }

      return null;
    },
    enabled:
      Boolean(userId) &&
      Boolean(conversacionId || ofertaId || demandaId) &&
      (params.enabled ?? true) &&
      isSupabaseConfigured,
  });
}

/**
 * Mensajes de una conversación ordenados cronológicamente con actualización en tiempo real.
 */
export function useMensajes(conversacionId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !conversacionId) return;

    const channel = supabase
      .channel(`mensajes-${conversacionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes",
          filter: `conversacion_id=eq.${conversacionId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["mensajes", conversacionId] });
          queryClient.invalidateQueries({ queryKey: ["conversaciones"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversacionId, queryClient]);

  return useQuery({
    queryKey: ["mensajes", conversacionId],
    queryFn: async (): Promise<MensajeRow[]> => {
      if (!conversacionId) return [];
      const { data, error } = await supabase
        .from("mensajes")
        .select("id, conversacion_id, remitente_id, cuerpo, creado_en")
        .eq("conversacion_id", conversacionId)
        .order("creado_en", { ascending: true });

      if (error) throw error;
      return (data ?? []) as MensajeRow[];
    },
    enabled: Boolean(conversacionId) && isSupabaseConfigured,
    refetchInterval: 8000,
  });
}

/**
 * Crea o recupera una conversación con una contraparte asociada a una oferta o demanda.
 */
export async function iniciarOAbrirConversacion(params: {
  contraparteId: string;
  ofertaId?: string | null;
  demandaId?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("iniciar_o_abrir_conversacion", {
    p_contraparte_id: params.contraparteId,
    p_oferta_id: params.ofertaId ?? null,
    p_demanda_id: params.demandaId ?? null,
  });

  if (error) throw error;
  return String(data);
}

/**
 * Envía un mensaje dentro de una conversación verificando primero que no
 * contenga datos de contacto ni vías externas.
 */
export async function enviarMensaje(params: {
  conversacionId: string;
  remitenteId: string;
  cuerpo: string;
}): Promise<MensajeRow> {
  const texto = params.cuerpo.trim();
  if (!texto) {
    throw new Error("Escribí un mensaje antes de enviar.");
  }

  const filtro = detectarDatosContacto(texto);
  if (filtro.bloqueado) {
    throw new Error(
      filtro.motivo ??
        "Por seguridad, no está permitido compartir datos de contacto en el chat."
    );
  }

  const { data, error } = await supabase
    .from("mensajes")
    .insert({
      conversacion_id: params.conversacionId,
      remitente_id: params.remitenteId,
      cuerpo: texto,
    })
    .select()
    .single();

  if (error) throw error;
  return data as MensajeRow;
}
