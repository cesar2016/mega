import "../global.css";

import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { useAuthStore } from "store/authStore";
import { ToastHost } from "components/ui/Toast";

const DEMO_USER = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@mercadoganadero.local",
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!isSupabaseConfigured) {
        const stored = useAuthStore.getState().user;
        if (!cancelled) await setUser(stored ?? DEMO_USER);
        return;
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
        <ToastHost />
      </View>
    </QueryClientProvider>
  );
}
