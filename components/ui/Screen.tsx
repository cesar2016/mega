import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "components/ui/Icon";

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
  onRefresh?: () => Promise<any> | void;
  refreshing?: boolean;
  /** Secciones a ancho completo dentro de una página con ancho máximo. */
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
};

const PULL_THRESHOLD = 64;
const MAX_PULL_DISTANCE = 110;

/**
 * Esqueleto de página responsive con soporte de Pull-to-Refresh táctil (deslizar hacia abajo)
 * tanto en app nativa como en navegadores móviles y PWA instalada:
 * - móvil: padding chico, columna única y gesto deslizar hacia abajo para actualizar
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
  const queryClient = useQueryClient();
  const scrollRef = useRef<any>(null);
  const scrollOffsetRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const [pullDistance, setPullDistance] = useState(0);
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const isRefreshing = Boolean(refreshing || internalRefreshing);

  const ejecutarRefresh = useCallback(async () => {
    try {
      setInternalRefreshing(true);
      await Promise.all([
        Promise.resolve(onRefresh?.()),
        queryClient.invalidateQueries(),
      ]);
    } finally {
      setTimeout(() => {
        setInternalRefreshing(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }, 350);
    }
  }, [onRefresh, queryClient]);

  // Soporte táctil Pull-to-Refresh para navegadores móviles y PWA en web
  useEffect(() => {
    if (Platform.OS !== "web" || !scroll) return;
    const rawNode = scrollRef.current as any;
    const domNode: HTMLElement | null =
      rawNode instanceof HTMLElement
        ? rawNode
        : rawNode?.getScrollableNode?.() ?? null;

    if (!domNode || typeof domNode.addEventListener !== "function") return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshing) return;
      const top = domNode.scrollTop ?? scrollOffsetRef.current ?? 0;
      if (top <= 2 && e.touches.length === 1) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = false;
      } else {
        startYRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || isRefreshing) return;
      const top = domNode.scrollTop ?? scrollOffsetRef.current ?? 0;
      if (top > 2) {
        startYRef.current = null;
        setPullDistance(0);
        pullDistanceRef.current = 0;
        return;
      }

      const deltaY = e.touches[0].clientY - startYRef.current;
      if (deltaY > 8) {
        pullingRef.current = true;
        const damped = Math.min(MAX_PULL_DISTANCE, Math.round((deltaY - 8) * 0.55));
        pullDistanceRef.current = damped;
        setPullDistance(damped);
      } else if (pullingRef.current) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!pullingRef.current) {
        startYRef.current = null;
        return;
      }
      const dist = pullDistanceRef.current;
      startYRef.current = null;
      pullingRef.current = false;

      if (dist >= PULL_THRESHOLD) {
        setPullDistance(PULL_THRESHOLD);
        void ejecutarRefresh();
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    domNode.addEventListener("touchstart", handleTouchStart, { passive: true });
    domNode.addEventListener("touchmove", handleTouchMove, { passive: true });
    domNode.addEventListener("touchend", handleTouchEnd, { passive: true });
    domNode.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      domNode.removeEventListener("touchstart", handleTouchStart);
      domNode.removeEventListener("touchmove", handleTouchMove);
      domNode.removeEventListener("touchend", handleTouchEnd);
      domNode.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [scroll, isRefreshing, ejecutarRefresh]);

  const mostrarIndicadorPull = pullDistance > 10 || isRefreshing;
  const listoParaSoltar = pullDistance >= PULL_THRESHOLD;

  const body = (
    <View className={`w-full max-w-shell self-center gap-6 px-4 py-5 md:px-8 md:py-8 ${contentClassName}`}>
      {mostrarIndicadorPull ? (
        <View
          style={{
            height: isRefreshing ? 44 : Math.max(32, pullDistance),
          }}
          className="items-center justify-center overflow-hidden"
        >
          <View className="flex-row items-center gap-2 rounded-full border border-sage-200 bg-surface px-4 py-1.5 shadow-sm">
            {isRefreshing ? (
              <>
                <ActivityIndicator size="small" className="text-sage-600" />
                <Text className="text-xs font-extrabold text-sage-800">
                  Actualizando pantalla...
                </Text>
              </>
            ) : (
              <>
                <Icon
                  name="refresh"
                  size={14}
                  className={listoParaSoltar ? "text-sage-700" : "text-ink-muted"}
                />
                <Text
                  className={`text-xs font-bold ${
                    listoParaSoltar ? "text-sage-800" : "text-ink-muted"
                  }`}
                >
                  {listoParaSoltar
                    ? "Soltá para actualizar"
                    : "Deslizá hacia abajo para actualizar"}
                </Text>
              </>
            )}
          </View>
        </View>
      ) : null}

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
      ref={scrollRef}
      className={`flex-1 bg-canvas ${className}`}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={Platform.OS === "web"}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            void ejecutarRefresh();
          }}
          tintColor="#16A34A"
        />
      }
    >
      {body}
    </ScrollView>
  );
}
