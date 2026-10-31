import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "store/authStore";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

/**
 * Barra de pestañas inferior para mobile (y web angosta).
 * En escritorio se usa `AppSidebar`.
 */
export function MobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <View
      className="flex-row items-stretch border-t border-line-soft bg-surface px-2 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : typeof options.title === "string"
              ? options.title
              : route.name;
        const focused = state.index === index;
        const badge = options.tabBarBadge;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!user && route.name !== "feed") {
                router.push({
                  pathname: "/auth",
                  params: { mode: "login", returnUrl: `/(main)/tabs/${route.name}` },
                });
                return;
              }

              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(
                  route.name,
                  route.name === "chat"
                    ? { id: undefined, ofertaId: undefined, demandaId: undefined }
                    : undefined
                );
              }
            }}
            className="flex-1 items-center gap-1 rounded-2xl py-1.5"
          >
            <View
              className={[
                "h-8 w-12 items-center justify-center rounded-xl",
                focused ? "bg-sage-50" : "",
              ].join(" ")}
            >
              {options.tabBarIcon ? (
                options.tabBarIcon({
                  focused,
                  color: focused ? "#4C6B54" : "#8C978E",
                  size: 20,
                })
              ) : null}
              {badge != null && badge !== "" ? (
                <View className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-clay-500 px-1">
                  <Text className="text-[10px] font-bold leading-4 text-white">{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              className={[
                "text-[10px]",
                focused ? "font-bold text-sage-700" : "font-medium text-ink-muted",
              ].join(" ")}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
