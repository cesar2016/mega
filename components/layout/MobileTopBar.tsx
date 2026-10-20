import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { Logo } from "components/ui/Logo";
import type { IconName } from "components/ui/Icon.types";

/** Barra superior compacta: sólo mobile. En escritorio la reemplaza el sidebar. */
export function MobileTopBar({
  title,
  action,
  onActionPress,
  actionIcon = "plus",
  onBack,
}: {
  title?: string;
  action?: boolean;
  onActionPress?: () => void;
  actionIcon?: IconName;
  onBack?: () => void;
}) {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);

  return (
    <View className="flex-row items-center gap-3 border-b border-line-soft bg-surface/80 px-4 py-3 md:hidden">
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          className="h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface active:bg-surface-sunk"
        >
          <Icon name="arrowLeft" size={18} className="text-ink-soft" />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push("/(main)/tabs/feed")}
          className="h-9 w-9 items-center justify-center rounded-full active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Ir al inicio"
        >
          <Logo size={36} />
        </Pressable>
      )}

      <View className="min-w-0 flex-1">
        <Text className="text-sm font-bold text-ink" numberOfLines={1}>
          {title ?? "Mercado Ganadero"}
        </Text>
        <Text className="text-[11px] text-ink-muted" numberOfLines={1}>
          {profile?.nombre ? `Hola, ${profile.nombre}` : "Compra y venta de hacienda"}
        </Text>
      </View>

      {action ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel="Acción"
          className="h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface active:bg-surface-sunk"
        >
          <Icon name={actionIcon} size={18} className="text-ink-soft" />
        </Pressable>
      ) : null}
    </View>
  );
}
