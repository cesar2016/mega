import { Redirect, Slot, Stack } from "expo-router";
import { View } from "react-native";
import { isSupabaseConfigured } from "lib/supabase";
import { useAuthRedirect } from "lib/hooks/useAuthRedirect";
import { useResponsive } from "lib/hooks/useResponsive";
import { useAuthStore } from "store/authStore";
import { AppSidebar } from "components/layout/AppSidebar";

export default function MainLayout() {
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const { isWide } = useResponsive();

  const redirect = useAuthRedirect();
  if (redirect) return redirect;

  if (loading) return null;

  // Sólo con Supabase configurado tiene sentido proteger las rutas: en modo
  // demo no hay sesión real y la app debe poder navegar libremente.
  if (isSupabaseConfigured && profile?.onboarding_completado === false) {
    return <Redirect href="/onboarding" />;
  }

  // En escritorio la navegación es lateral y acompaña a todas las pantallas
  // (incluido el formulario de publicación).
  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-canvas">
        <AppSidebar />
        <View className="flex-1">
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
