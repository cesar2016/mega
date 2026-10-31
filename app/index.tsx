import React from "react";
import { View } from "react-native";
import { useResponsive } from "lib/hooks/useResponsive";
import { AppSidebar } from "components/layout/AppSidebar";
import { StandaloneMobileTabBar } from "components/layout/MobileTabBar";
import FeedScreen from "features/feed/FeedScreen";

export default function HomeScreen() {
  const { isWide } = useResponsive();

  if (isWide) {
    return (
      <View className="flex-1 flex-row bg-canvas">
        <AppSidebar />
        <View className="flex-1">
          <FeedScreen />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1">
        <FeedScreen />
      </View>
      <StandaloneMobileTabBar activeTab="feed" />
    </View>
  );
}


