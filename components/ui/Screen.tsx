import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type GradientProps = {
  colors: readonly [string, string, ...string[]];
  className?: string;
  children?: React.ReactNode;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
};

/** Degradado suave ("difuminado") usado en cabeceras y tarjetas destacado. */
export function Gradient({
  colors,
  className = "",
  children,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
}: GradientProps) {
  return (
    <LinearGradient colors={colors} start={start} end={end} className={className}>
      {children}
    </LinearGradient>
  );
}

type ScreenProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  scroll?: boolean;
  /** Pull-to-refresh (sólo web/mobile con scroll). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Secciones a ancho completo dentro de una página con ancho máximo. */
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
};

/**
 * Esqueleto de página responsive:
 * - móvil: padding chico y columna única
 * - escritorio (web): contenedor centrado con ancho máximo y aire lateral
 */
export function Screen({
  children,
  title,
  subtitle,
  eyebrow,
  action,
  scroll = true,
  onRefresh,
  refreshing = false,
  className = "",
  contentClassName = "",
  headerClassName = "",
}: ScreenProps) {
  const body = (
    <View className={`w-full max-w-shell self-center gap-6 px-4 py-5 md:px-8 md:py-8 ${contentClassName}`}>
      {title || eyebrow || subtitle || action ? (
        <View
          className={`flex-row flex-wrap items-end justify-between gap-4 ${headerClassName}`}
        >
          <View className="min-w-0 flex-1 gap-1.5">
            {eyebrow ? (
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-sage-600">
                {eyebrow}
              </Text>
            ) : null}
            {title ? (
              <Text className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text className="max-w-2xl text-sm leading-5 text-ink-muted md:text-base">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action ? (
            <View className="hidden items-center gap-2 md:flex">{action}</View>
          ) : null}
        </View>
      ) : null}

      {children}
    </View>
  );

  if (!scroll) {
    return <View className={`flex-1 bg-canvas ${className}`}>{body}</View>;
  }

  return (
    <ScrollView
      className={`flex-1 bg-canvas ${className}`}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5F8668" />
        ) : undefined
      }
    >
      {body}
    </ScrollView>
  );
}
