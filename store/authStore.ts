import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase, isSupabaseConfigured } from "lib/supabase";

export type UserRol = "productor" | "comprador" | "fletero" | "admin";

export interface UserProfile {
  id: string;
  nombre: string | null;
  nombre_completo?: string | null;
  telefono: string | null;
  avatar_url: string | null;
  rol: UserRol;
  onboarding_completado: boolean;
  email_confirmed_at: string | null;
  cuit: string | null;
  establecimiento?: string | null;
  renspa?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  verificado: boolean | null;
  radio_km?: number | null;
}

// Perfil sintético para levantar la app sin credenciales de Supabase.
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000000";

const DEMO_PROFILE: UserProfile = {
  id: DEMO_USER_ID,
  nombre: "Usuario_Demo1!",
  nombre_completo: "Usuario Demo",
  telefono: null,
  avatar_url: null,
  rol: "comprador",
  onboarding_completado: true,
  email_confirmed_at: new Date().toISOString(),
  cuit: null,
  establecimiento: null,
  renspa: null,
  provincia: null,
  localidad: null,
  verificado: false,
  radio_km: 200,
};

interface AuthState {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  setUser: (user: { id: string; email?: string } | null) => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  resetProfile: () => void;
  signOut: () => Promise<void>;
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

          const row = data as any;
          const prod = Array.isArray(row.productores) ? row.productores[0] : row.productores;
          const flet = Array.isArray(row.fleteros) ? row.fleteros[0] : row.fleteros;

          set({
            profile: {
              ...row,
              nombre_completo: row.nombre_completo ?? null,
              cuit: row.cuit ?? prod?.cuit ?? null,
              establecimiento: row.establecimiento ?? prod?.establecimiento ?? null,
              renspa: row.renspa ?? prod?.renspa ?? null,
              provincia: row.provincia ?? null,
              localidad: row.localidad ?? null,
              verificado: prod?.verificado ?? flet?.verificado ?? null,
              radio_km: row.radio_km ?? flet?.radio_km ?? null,
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
          const current = get().profile;
          const payloadProfiles: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };

          if (data.nombre !== undefined) payloadProfiles.nombre = data.nombre?.trim() || null;
          if (data.nombre_completo !== undefined)
            payloadProfiles.nombre_completo = data.nombre_completo?.trim() || null;
          if (data.telefono !== undefined) payloadProfiles.telefono = data.telefono?.trim() || null;
          if (data.avatar_url !== undefined)
            payloadProfiles.avatar_url = data.avatar_url?.trim() || null;
          if (data.cuit !== undefined) payloadProfiles.cuit = data.cuit?.trim() || null;
          if (data.establecimiento !== undefined)
            payloadProfiles.establecimiento = data.establecimiento?.trim() || null;
          if (data.renspa !== undefined) payloadProfiles.renspa = data.renspa?.trim() || null;
          if (data.provincia !== undefined)
            payloadProfiles.provincia = data.provincia?.trim() || null;
          if (data.localidad !== undefined)
            payloadProfiles.localidad = data.localidad?.trim() || null;
          if (data.rol !== undefined) payloadProfiles.rol = data.rol;
          if (data.radio_km !== undefined) payloadProfiles.radio_km = data.radio_km;

          const { error } = await supabase
            .from("profiles")
            .update(payloadProfiles)
            .eq("id", user.id);

          if (error) throw error;

          // Sincronizar con tabla productores
          if (
            data.cuit !== undefined ||
            data.establecimiento !== undefined ||
            data.renspa !== undefined
          ) {
            await supabase.from("productores").upsert({
              user_id: user.id,
              cuit: (data.cuit ?? current?.cuit)?.trim() || null,
              establecimiento: (data.establecimiento ?? current?.establecimiento)?.trim() || null,
              renspa: (data.renspa ?? current?.renspa)?.trim() || null,
            });
          }

          // Sincronizar con tabla fleteros si aplica
          if (data.radio_km !== undefined || (data.rol ?? current?.rol) === "fletero") {
            await supabase.from("fleteros").upsert({
              user_id: user.id,
              radio_km: data.radio_km ?? current?.radio_km ?? 200,
            });
          }

          set({ profile: { ...(current as UserProfile), ...data } });
        } catch (err) {
          console.error("Error updating profile:", err);
          throw err;
        }
      },

      resetProfile: () => {
        set({ profile: null });
      },

      signOut: async () => {
        set({ user: null, profile: null, loading: false });
        if (isSupabaseConfigured) {
          try {
            await supabase.auth.signOut();
          } catch (err) {
            console.error("Error signing out from Supabase:", err);
          }
        }
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
