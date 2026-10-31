import React from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useAuthStore } from "store/authStore";
import { usePendientesMatch } from "lib/hooks/useMatches";
import { useMensajesSinLeer } from "lib/hooks/useChat";
import { Icon } from "components/ui/Icon";
import { Avatar } from "components/ui/Avatar";
import { Logo } from "components/ui/Logo";
import { NAV_ITEMS, activeNavItem } from "./navItems";

const ROLE_LABEL: Record<string, string> = {
  productor: "Compra y venta",
  comprador: "Compra y venta",
  fletero: "Transportista",
  admin: "Administrador",
};

/**
 * Navegación lateral para escritorio (web >= 1024px). Reemplaza las
 * pestañas inferiores cuando hay ancho suficiente.
 */
export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const profile = useAuthStore((state) => state.profile);

  const activo = activeNavItem(pathname);
  const pendientes = usePendientesMatch({ enabled: !!profile });
  const mensajesSinLeer = useMensajesSinLeer({ enabled: !!profile });

  return (
    <View className="h-full w-[264px] shrink-0 border-r border-line-soft bg-surface px-4 py-6">
      {/* Marca */}
      <View className="mb-8 flex-row items-center gap-3 px-2">
        <Logo size={44} className="rounded-full shadow-sm" />
        <View className="flex-1">
          <Text className="text-[15px] font-bold leading-5 text-ink">Mercado Ganadero</Text>
          <Text className="text-[11px] leading-4 text-ink-muted">Compra y venta de hacienda</Text>
        </View>
      </View>

      {/* Navegación */}
      <View className="gap-1">
        {NAV_ITEMS.map((item) => {
          const focused = activo?.name === item.name;
          const badge =
            item.name === "matches"
              ? pendientes
              : item.name === "chat"
                ? mensajesSinLeer
                : 0;

          return (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              onPress={() => {
                if (!profile && item.name !== "feed") {
                  router.push({
                    pathname: "/auth",
                    params: { mode: "login", returnUrl: item.href as string },
                  });
                  return;
                }
                router.push(item.href);
              }}
              className={[
                "flex-row items-center gap-3 rounded-2xl px-3 py-2.5",
                focused ? "bg-sage-50" : "active:bg-surface-sunk",
              ].join(" ")}
            >
              <View className="relative">
                <Icon
                  name={item.icon}
                  size={18}
                  className={focused ? "text-sage-600" : "text-ink-muted"}
                />
                {item.name === "chat" && mensajesSinLeer > 0 ? (
                  <View className="absolute -right-2 -top-1.5 min-w-[16px] items-center justify-center rounded-full bg-clay-500 px-1">
                    <Text className="text-[9px] font-bold leading-3.5 text-white">
                      {mensajesSinLeer > 99 ? "99+" : mensajesSinLeer}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                className={[
                  "text-sm",
                  focused ? "font-bold text-sage-700" : "font-medium text-ink-soft",
                ].join(" ")}
              >
                {item.title}
              </Text>
              {badge > 0 ? (
                <View className="ml-auto min-w-[20px] items-center justify-center rounded-full bg-clay-500 px-1.5 py-0.5">
                  <Text className="text-[10px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View className="flex-1" />

      {/* Acción principal */}
      <Pressable
        onPress={() => router.push(profile ? "/(main)/oferta-nueva" : "/auth")}
        accessibilityRole="button"
        accessibilityLabel="Publicar oferta"
        className="mb-4 flex-row items-center justify-center gap-2 rounded-2xl bg-sage-500 px-4 py-3 active:bg-sage-600"
      >
        <Icon name="plus" size={18} className="text-white" />
        <Text className="text-sm font-bold text-white">Publicar oferta</Text>
      </Pressable>

      {/* Usuario */}
      {profile ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-line-soft bg-surface-soft px-3 py-2.5">
          <Avatar uri={profile?.avatar_url} nombre={profile?.nombre} size={36} />
          <View className="min-w-0 flex-1">
            <Text className="text-[13px] font-semibold text-ink" numberOfLines={1}>
              {profile.nombre}
            </Text>
            <Text className="text-[11px] capitalize text-ink-muted" numberOfLines={1}>
              {ROLE_LABEL[profile.rol ?? ""] ?? "Mercado"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(main)/tabs/perfil")}
            accessibilityRole="button"
            accessibilityLabel="Ver perfil"
            className="h-8 w-8 items-center justify-center rounded-lg active:bg-surface-sunk"
          >
            <Icon name="chevronRight" size={16} className="text-ink-muted" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push("/auth")}
          accessibilityRole="button"
          accessibilityLabel="Iniciar sesión o registrarse"
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-sage-200 bg-sage-50 px-3.5 py-3 active:bg-sage-100"
        >
          <Icon name="user" size={16} className="text-sage-700" />
          <Text className="text-xs font-bold text-sage-800">Iniciar sesión / Registrarse</Text>
        </Pressable>
      )}
    </View>
  );
}
