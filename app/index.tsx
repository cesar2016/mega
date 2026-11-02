import React from "react";
import { View } from "react-native";
import { useResponsive } from "lib/hooks/useResponsive";
import { useAuthStore } from "store/authStore";
import { AppSidebar } from "components/layout/AppSidebar";
import { PublicTopNavbar } from "components/layout/PublicTopNavbar";
import { StandaloneMobileTabBar } from "components/layout/MobileTabBar";
import FeedScreen from "features/feed/FeedScreen";

export default function HomeScreen() {
  const { isWide } = useResponsive();
  const user = useAuthStore((state) => state.user);

  // Visitante no logueado: sin menú lateral, con navbar superior siempre fijo y permanente
  if (!user) {
    return (
      <View className="flex-1 bg-canvas">
        <PublicTopNavbar />
        <View className="flex-1 min-h-0">
          <FeedScreen />
        </View>
      </View>
    );
  }

  // Usuario logueado en escritorio: barra lateral con navegación completa
  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-canvas">
        <AppSidebar />
        <View className="flex-1 min-w-0">
          <FeedScreen />
        </View>
      </View>
    );
  }

  // Usuario logueado en móvil: barra de navegación inferior
  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1 min-h-0">
        <FeedScreen />
      </View>
      <StandaloneMobileTabBar activeTab="feed" />
    </View>
  );
}
