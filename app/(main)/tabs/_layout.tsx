import React from "react";
import { Tabs } from "expo-router";
import { useResponsive } from "lib/hooks/useResponsive";
import { usePendientesMatch } from "lib/hooks/useMatches";
import { useMensajesSinLeer } from "lib/hooks/useChat";
import { useOperacionesSinVer } from "lib/hooks/useOperaciones";
import { useAuthStore } from "store/authStore";
import { MobileTabBar } from "components/layout/MobileTabBar";
import { Icon } from "components/ui/Icon";
import { NAV_ITEMS } from "components/layout/navItems";

export default function TabsLayout() {
  const { isWide } = useResponsive();
  const profile = useAuthStore((state) => state.profile);
  const pendientes = usePendientesMatch({ enabled: !!profile });
  const mensajesSinLeer = useMensajesSinLeer({ enabled: !!profile });
  const { totalSinVer: totalOperaciones } = useOperacionesSinVer(profile?.id);

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
              item.name === "matches" && pendientes > 0
                ? pendientes
                : item.name === "chat" && mensajesSinLeer > 0
                  ? mensajesSinLeer > 99
                    ? "99+"
                    : mensajesSinLeer
                  : item.name === "operaciones" && totalOperaciones > 0
                    ? totalOperaciones > 99
                      ? "99+"
                      : totalOperaciones
                    : undefined,
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
