import { Redirect, Slot, Stack } from "expo-router";
import { View } from "react-native";
import { isSupabaseConfigured } from "lib/supabase";
import { useResponsive } from "lib/hooks/useResponsive";
import { useAuthStore } from "store/authStore";
import { AppSidebar } from "components/layout/AppSidebar";
import { PublicTopNavbar } from "components/layout/PublicTopNavbar";

export default function MainLayout() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const { isWide } = useResponsive();

  if (loading) return null;

  // Sólo con Supabase configurado tiene sentido proteger las rutas: en modo
  // demo no hay sesión real y la app debe poder navegar libremente.
  if (isSupabaseConfigured && user && profile?.onboarding_completado === false) {
    return <Redirect href="/onboarding" />;
  }

  // Visitante no logueado: sin menú lateral, con navbar superior siempre fijo y permanente
  if (!user) {
    return (
      <View className="flex-1 bg-canvas">
        <PublicTopNavbar />
        <View className="flex-1 min-h-0">
          <Slot />
        </View>
      </View>
    );
  }

  // En escritorio (usuario logueado) la navegación es lateral y acompaña a todas las pantallas
  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-canvas">
        <AppSidebar />
        <View className="flex-1 min-w-0">
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="tabs" />
      <Stack.Screen name="oferta-nueva" options={{ presentation: "modal" }} />
      <Stack.Screen name="oferta/[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
