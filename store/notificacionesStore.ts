import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificacionesVistasState {
  operacionesVistasIds: string[];
  matchesVistosIds: string[];
  conversacionesVistasMap: Record<string, string>;

  marcarOperacionesVistas: (ids: string[]) => void;
  marcarMatchesVistos: (ids: string[]) => void;
  marcarConversacionVista: (convId: string, timestampIso?: string | null) => void;
  marcarTodasConversacionesVistas: (
    convs: {
      id: string;
      ultimo_mensaje_en?: string | null;
      ultimo_mensaje?: { creado_en?: string | null } | null;
    }[]
  ) => void;
}

export const useNotificacionesStore = create<NotificacionesVistasState>()(
  persist(
    (set) => ({
      operacionesVistasIds: [],
      matchesVistosIds: [],
      conversacionesVistasMap: {},

      marcarOperacionesVistas: (ids) => {
        if (!ids || ids.length === 0) return;
        set((state) => {
          const conjunto = new Set([...state.operacionesVistasIds, ...ids]);
          if (conjunto.size === state.operacionesVistasIds.length) return state;
          return { operacionesVistasIds: Array.from(conjunto) };
        });
      },

      marcarMatchesVistos: (ids) => {
        if (!ids || ids.length === 0) return;
        set((state) => {
          const conjunto = new Set([...state.matchesVistosIds, ...ids]);
          if (conjunto.size === state.matchesVistosIds.length) return state;
          return { matchesVistosIds: Array.from(conjunto) };
        });
      },

      marcarConversacionVista: (convId, timestampIso) => {
        if (!convId) return;
        const ts = timestampIso || new Date().toISOString();
        set((state) => ({
          conversacionesVistasMap: {
            ...state.conversacionesVistasMap,
            [convId]: ts,
          },
        }));
      },

      marcarTodasConversacionesVistas: (convs) => {
        if (!convs || convs.length === 0) return;
        const ahora = new Date().toISOString();
        set((state) => {
          const nextMap = { ...state.conversacionesVistasMap };
          for (const c of convs) {
            const ts = c.ultimo_mensaje?.creado_en || c.ultimo_mensaje_en || ahora;
            nextMap[c.id] = ts > ahora ? ts : ahora;
          }
          return { conversacionesVistasMap: nextMap };
        });
      },
    }),
    {
      name: "mercado-ganadero-badges-vistos-v1",
    }
  )
);
