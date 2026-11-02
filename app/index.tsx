import React from "react";
import { View } from "react-native";
import { useResponsive } from "lib/hooks/useResponsive";
import { AppSidebar } from "components/layout/AppSidebar";
import { StandaloneMobileTabBar } from "components/layout/MobileTabBar";
import FeedScreen from "features/feed/FeedScreen";

export default function HomeScreen() {
  const { isWide } = useResponsive();

  // Vista en escritorio: barra lateral fija con navegación completa
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

  // Vista en móvil: barra de navegación inferior fija siempre presente
  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1 min-h-0">
        <FeedScreen />
      </View>
      <StandaloneMobileTabBar activeTab="feed" />
    </View>
  );
}


