import { useEffect } from "react";
import { Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import type { UserProfile } from "store/authStore";

export const SUPERADMIN_USER_ID = "5446e68a-1482-452d-9bfe-e0bd3eb7d361";
export const SUPERADMIN_USERNAME_NORMALIZED = "mega.oficial_1";

/**
 * Determina si el usuario actual es el único SuperAdmin autorizado: Mega.Oficial_1
 */
export function isSuperAdmin(
  profile?: UserProfile | null,
  user?: { id?: string | null; email?: string | null } | null
): boolean {
  if (!profile && !user) return false;
  if (user?.id === SUPERADMIN_USER_ID || profile?.id === SUPERADMIN_USER_ID) {
    return true;
  }
  const nombreNorm = (profile?.nombre ?? "").replace(/\s+/g, "").toLowerCase();
  if (nombreNorm === SUPERADMIN_USERNAME_NORMALIZED) {
    return true;
  }
  if (profile?.rol === "admin") {
    return true;
  }
  return false;
}

export type UsuarioRegistradoAdmin = {
  id: string;
  nombre: string | null;
  nombre_completo: string | null;
  email: string | null;
  cuit: string | null;
  telefono: string | null;
  rol: string | null;
  establecimiento: string | null;
  renspa: string | null;
  provincia: string | null;
  localidad: string | null;
  verificado: boolean;
  email_confirmed_at: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  total_ofertas: number;
  total_visitas_sitio: number;
};

export type VisitaSitioRow = {
  id: string;
  visitor_id: string;
  session_id: string | null;
  user_id: string | null;
  usuario_nombre: string | null;
  usuario_nombre_completo: string | null;
  usuario_email: string | null;
  ip: string | null;
  pais: string | null;
  provincia: string | null;
  ciudad: string | null;
  dispositivo: string | null;
  ruta: string | null;
  created_at: string;
};

const VISITOR_STORAGE_KEY = "mg_site_visitor_id_v1";
const SESSION_STORAGE_KEY = "mg_site_session_registered_v1";
const SESSION_USER_SYNC_KEY = "mg_site_session_user_synced_v1";

function obtenerOGenerarVisitorId(): string {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      let actual = window.localStorage.getItem(VISITOR_STORAGE_KEY);
      if (!actual) {
        actual =
          "vis_" +
          Math.random().toString(36).slice(2, 10) +
          "_" +
          Date.now().toString(36);
        window.localStorage.setItem(VISITOR_STORAGE_KEY, actual);
      }
      return actual;
    }
  } catch {
    // ignore storage errors
  }
  return "vis_anon_" + Math.random().toString(36).slice(2, 10);
}

function detectarDispositivoCliente(): string {
  if (Platform.OS !== "web" || typeof navigator === "undefined") {
    return Platform.OS === "ios" ? "iOS App" : Platform.OS === "android" ? "Android App" : "Móvil";
  }
  const ua = navigator.userAgent || "";
  const so = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Web";
  const nav = /Edg\//i.test(ua)
    ? "Edge"
    : /Chrome\//i.test(ua)
      ? "Chrome"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Safari\//i.test(ua)
          ? "Safari"
          : "Navegador";
  return `${so} · ${nav}`;
}

/**
 * Registra automáticamente cada sesión de visita al sitio con quién la realiza y desde dónde.
 */
export function useRegistrarVisitaSitio(
  user?: { id: string; email?: string } | null,
  profile?: UserProfile | null
) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelado = false;

    const registrar = async () => {
      try {
        const visitorId = obtenerOGenerarVisitorId();
        const dispositivo = detectarDispositivoCliente();
        const ruta =
          typeof window !== "undefined" && window.location
            ? window.location.pathname || "/"
            : "/";

        let sessionId = "";
        if (typeof window !== "undefined" && window.sessionStorage) {
          sessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY) || "";
        }

        // Si ya se registró la sesión pero ahora el usuario inició sesión, actualizar la fila con su usuario y ubicación
        if (sessionId) {
          if (user?.id && typeof window !== "undefined" && window.sessionStorage) {
            const yaSincronizado = window.sessionStorage.getItem(SESSION_USER_SYNC_KEY);
            if (yaSincronizado !== user.id) {
              window.sessionStorage.setItem(SESSION_USER_SYNC_KEY, user.id);
              const updateFields: Record<string, any> = {
                user_id: user.id,
                usuario_nombre: profile?.nombre || user.email?.split("@")[0] || null,
              };
              if (profile?.provincia) updateFields.provincia = profile.provincia;
              if (profile?.localidad) updateFields.ciudad = profile.localidad;

              await supabase
                .from("sitio_visitas")
                .update(updateFields)
                .eq("session_id", sessionId);
            }
          }
          return;
        }

        const nuevoSessionId =
          "ses_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
        if (typeof window !== "undefined" && window.sessionStorage) {
          window.sessionStorage.setItem(SESSION_STORAGE_KEY, nuevoSessionId);
          if (user?.id) {
            window.sessionStorage.setItem(SESSION_USER_SYNC_KEY, user.id);
          }
        }

        // 1. Intentar obtener geolocalización por IP desde /api/visita o ipapi
        let ip: string | null = null;
        let pais: string | null = "Argentina";
        let provincia: string | null = profile?.provincia || null;
        let ciudad: string | null = profile?.localidad || null;

        try {
          const res = await fetch("/api/visita", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provincia: profile?.provincia || null,
              ciudad: profile?.localidad || null,
              dispositivo,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.geo) {
              ip = data.geo.ip || ip;
              pais = data.geo.pais || pais;
              provincia = data.geo.provincia || provincia;
              ciudad = data.geo.ciudad || ciudad;
            }
          }
        } catch {
          // ignore
        }

        // Si no vino provincia/ciudad por cabeceras de Vercel, consultar servicio geo público liviano
        if (!provincia || !ciudad || !ip) {
          try {
            const geoRes = await fetch("https://ipapi.co/json/");
            if (geoRes.ok) {
              const geoJson = await geoRes.json();
              ip = ip || geoJson.ip || null;
              pais = geoJson.country_name || pais || "Argentina";
              provincia = provincia || geoJson.region || null;
              ciudad = ciudad || geoJson.city || null;
            }
          } catch {
            // ignore
          }
        }

        if (cancelado) return;

        await supabase.from("sitio_visitas").insert({
          visitor_id: visitorId,
          session_id: nuevoSessionId,
          user_id: user?.id ?? null,
          usuario_nombre: profile?.nombre || user?.email?.split("@")[0] || null,
          ip: ip || null,
          pais: pais || "Argentina",
          provincia: provincia || "Sin especificar",
          ciudad: ciudad || "Sin especificar",
          dispositivo,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : Platform.OS,
          ruta,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
        });
      } catch (e) {
        console.warn("No se pudo registrar visita del sitio:", e);
      }
    };

    void registrar();

    return () => {
      cancelado = true;
    };
  }, [user?.id, user?.email, profile?.nombre, profile?.provincia, profile?.localidad]);
}

/**
 * Consulta exclusiva para Mega.Oficial_1: usuarios registrados y visitas del sitio.
 */
export function useSuperAdminData(enabled: boolean) {
  const usuariosQuery = useQuery({
    queryKey: ["superadmin_usuarios"],
    queryFn: async (): Promise<UsuarioRegistradoAdmin[]> => {
      const { data, error } = await supabase.rpc("obtener_usuarios_superadmin");
      if (error) throw error;
      return ((data ?? []) as any[]).map((u) => ({
        ...u,
        total_ofertas: Number(u.total_ofertas ?? 0),
        total_visitas_sitio: Number(u.total_visitas_sitio ?? 0),
      }));
    },
    enabled: enabled && isSupabaseConfigured,
    refetchInterval: 30000,
  });

  const visitasQuery = useQuery({
    queryKey: ["superadmin_visitas"],
    queryFn: async (): Promise<VisitaSitioRow[]> => {
      const { data, error } = await supabase.rpc("obtener_visitas_superadmin");
      if (error) throw error;
      return (data ?? []) as VisitaSitioRow[];
    },
    enabled: enabled && isSupabaseConfigured,
    refetchInterval: 20000,
  });

  return {
    usuarios: usuariosQuery.data ?? [],
    visitas: visitasQuery.data ?? [],
    isLoading: usuariosQuery.isLoading || visitasQuery.isLoading,
    isRefetching: usuariosQuery.isRefetching || visitasQuery.isRefetching,
    error: usuariosQuery.error || visitasQuery.error,
    refetch: async () => {
      await Promise.all([usuariosQuery.refetch(), visitasQuery.refetch()]);
    },
  };
}
