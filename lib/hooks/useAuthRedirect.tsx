import React from "react";
import { Redirect } from "expo-router";
import { isSupabaseConfigured } from "lib/supabase";
import { useAuthStore } from "store/authStore";

/**
 * Redirige a /auth cuando hay sesión real pero el usuario no está autenticado.
 * En modo demo (sin Supabase configurado) no redirige: hay un perfil sintético.
 */
export function useAuthRedirect(options?: { enabled?: boolean }): React.ReactElement | null {
  const enabled = options?.enabled ?? true;
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (!enabled || loading) return null;
  if (isSupabaseConfigured && !user) return <Redirect href="/auth" />;
  return null;
}

/**
 * Para la pantalla de auth: si ya hay sesión, va directo a la app (o a returnUrl).
 */
export function useGuestRedirect(defaultHref: string = "/(main)/tabs/feed"): React.ReactElement | null {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  if (loading) return null;
  if (isSupabaseConfigured && user) return <Redirect href={defaultHref as any} />;
  return null;
}

/**
 * Para la pantalla de onboarding: va a /auth si no hay usuario, y a la app si
 * el onboarding ya está completo.
 */
export function useOnboardingRedirect(): React.ReactElement | null {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);

  if (loading) return null;
  if (isSupabaseConfigured && !user) return <Redirect href="/auth" />;
  if (profile?.onboarding_completado === true) return <Redirect href="/(main)/tabs/feed" />;
  return null;
}
