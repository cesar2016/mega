import React from "react";
import { View } from "react-native";
import { useResponsive } from "lib/hooks/useResponsive";
import { useAuthStore } from "store/authStore";
import { AppSidebar } from "components/layout/AppSidebar";
import { StandaloneMobileTabBar } from "components/layout/MobileTabBar";
import FeedScreen from "features/feed/FeedScreen";

export default function HomeScreen() {
  const { isWide } = useResponsive();
  const user = useAuthStore((state) => state.user);

  // Vista autenticada en escritorio: barra lateral con navegación completa
  if (isWide && user) {
    return (
      <View className="flex-1 flex-row bg-canvas">
        <AppSidebar />
        <View className="flex-1">
          <FeedScreen />
        </View>
      </View>
    );
  }

  // Vista autenticada en móvil: barra de navegación inferior
  if (user) {
    return (
      <View className="flex-1 bg-canvas">
        <View className="flex-1">
          <FeedScreen />
        </View>
        <StandaloneMobileTabBar activeTab="feed" />
      </View>
    );
  }

  // Vista pública (sin iniciar sesión): sin menú lateral ni barras con navegación privada
  return (
    <View className="flex-1 bg-canvas">
      <FeedScreen />
    </View>
  );
}


