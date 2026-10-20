import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase, isSupabaseConfigured } from "lib/supabase";

export type UserRol = "productor" | "comprador" | "fletero" | "admin";

export interface UserProfile {
  id: string;
  nombre: string | null;
  telefono: string | null;
  avatar_url: string | null;
  rol: UserRol;
  onboarding_completado: boolean;
  email_confirmed_at: string | null;
  cuit: string | null;
  verificado: boolean | null;
  radio_km?: number | null;
}

// Perfil sintético para levantar la app sin credenciales de Supabase.
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

const DEMO_PROFILE: UserProfile = {
  id: DEMO_USER_ID,
  nombre: "Usuario Demo",
  telefono: null,
  avatar_url: null,
  rol: "comprador",
  onboarding_completado: true,
  email_confirmed_at: new Date().toISOString(),
  cuit: null,
  verificado: false,
};

interface AuthState {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: { id: string; email?: string } | null) => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  resetProfile: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: true,

      setUser: async (user) => {
        set({ user, loading: false });

        if (!user) {
          set({ profile: null });
          return;
        }

        if (!isSupabaseConfigured) {
          set({ profile: { ...DEMO_PROFILE, id: user.id } });
          return;
        }

        await get().fetchProfile();
      },

      fetchProfile: async () => {
        const user = get().user;
        if (!user?.id) return;

        if (!isSupabaseConfigured) {
          set({ profile: { ...DEMO_PROFILE, id: user.id } });
          return;
        }

        try {
          const { data, error } = await supabase
            .from("profiles")
            .select(`
              *,
              productores (*),
              fleteros (*)
            `)
            .eq("id", user.id)
            .single();

          if (error) throw error;

          // cuit / verificado viven en productores y radio_km en fleteros:
          // la app los lee planos en el perfil.
          const row = data as any;
          set({
            profile: {
              ...row,
              cuit: row.productores?.cuit ?? null,
              verificado: row.productores?.verificado ?? row.fleteros?.verificado ?? null,
              radio_km: row.fleteros?.radio_km ?? null,
            } as UserProfile,
          });
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      },

      updateProfile: async (data) => {
        const user = get().user;
        if (!user?.id) return;

        if (!isSupabaseConfigured) {
          set({ profile: { ...(get().profile ?? DEMO_PROFILE), ...data } });
          return;
        }

        try {
          const { error } = await supabase
            .from("profiles")
            .update({
              nombre: data.nombre,
              telefono: data.telefono,
              avatar_url: data.avatar_url,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          if (error) throw error;

          set({ profile: { ...(get().profile as UserProfile), ...data } });
        } catch (err) {
          console.error("Error updating profile:", err);
          throw err;
        }
      },

      resetProfile: () => {
        set({ profile: null });
      },
    }),
    {
      name: "mercado-ganadero-auth",
      // Only persist user and profile, not the loading state
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
      }),
    }
  )
);
