import "../global.css";

import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { registerPwaServiceWorker } from "lib/pwa";
import { usePushNotificationsBootstrap } from "lib/pushNotifications";
import { useRegistrarVisitaSitio } from "lib/superAdmin";
import { useAuthStore } from "store/authStore";
import { PwaInstallSheet } from "components/pwa/InstallAppButton";
import { ToastHost } from "components/ui/Toast";
import { showToast } from "lib/utils";

const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@mercadoganadero.local",
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);

  useRegistrarVisitaSitio(user, profile);
  usePushNotificationsBootstrap(user?.id);

  useEffect(() => {
    registerPwaServiceWorker();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!isSupabaseConfigured) {
        const stored = useAuthStore.getState().user;
        if (!cancelled) await setUser(stored ?? DEMO_USER);
        return;
      }

      // Procesar confirmación de email / tokens en la URL (Web)
      if (Platform.OS === "web" && typeof window !== "undefined") {
        try {
          const searchParams = new URLSearchParams(window.location.search);
          const hashParams = new URLSearchParams(
            window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
          );

          const errorDesc = searchParams.get("error_description") || hashParams.get("error_description");
          if (errorDesc) {
            showToast(decodeURIComponent(errorDesc), "error");
          }

          const code = searchParams.get("code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error && data?.session?.user && !cancelled) {
              await setUser(data.session.user);
              const cleanUrl = window.location.pathname + (window.location.hash || "");
              window.history.replaceState({}, document.title, cleanUrl);
              return;
            }
          }

          const tokenHash = searchParams.get("token_hash") || hashParams.get("token_hash");
          const type = (searchParams.get("type") || hashParams.get("type")) as any;
          if (tokenHash && type) {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type || "signup",
            });
            if (!error && data?.session?.user && !cancelled) {
              await setUser(data.session.user);
              const cleanUrl = window.location.pathname;
              window.history.replaceState({}, document.title, cleanUrl);
              return;
            }
          }
        } catch (authUrlErr) {
          console.warn("[auth] Error procesando tokens de URL:", authUrlErr);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) await setUser(data.session?.user ?? null);
    };

    bootstrap();

    if (!isSupabaseConfigured) return;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [setUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <View className="flex-1">
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(main)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <PwaInstallSheet />
        <ToastHost />
      </View>
    </QueryClientProvider>
  );
}
