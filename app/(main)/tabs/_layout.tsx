import React from "react";
import { Tabs } from "expo-router";
import { useResponsive } from "lib/hooks/useResponsive";
import { usePendientesMatch } from "lib/hooks/useMatches";
import { useAuthStore } from "store/authStore";
import { MobileTabBar } from "components/layout/MobileTabBar";
import { Icon } from "components/ui/Icon";
import { NAV_ITEMS } from "components/layout/navItems";

export default function TabsLayout() {
  const { isWide } = useResponsive();
  const profile = useAuthStore((state) => state.profile);
  const pendientes = usePendientesMatch({ enabled: !!profile });

  return (
    <Tabs
      // En escritorio la navegación lateral vive en el layout de (main);
      // acá sólo queda la barra inferior para mobile.
      tabBar={(props) => (isWide ? null : <MobileTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#F4F2EC" },
      }}
    >
      {NAV_ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarBadge:
              item.name === "matches" && pendientes > 0 ? pendientes : undefined,
            tabBarBadgeStyle: {
              backgroundColor: "#C4764F",
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: "700",
            },
            tabBarIcon: ({ color, size }) => (
              <Icon name={item.icon} color={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
