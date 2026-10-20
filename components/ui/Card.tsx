import React from "react";
import { Text, View } from "react-native";
import { Icon } from "./Icon";
import type { IconName } from "./Icon.types";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
};

/** Tarjeta base: superficie blanca, borde suave y sombra difusa. */
export function Card({ children, className = "", padded = true }: CardProps) {
  return (
    <View
      className={[
        "rounded-3xl border border-line-soft bg-surface shadow-soft",
        padded ? "p-5" : "",
        className,
      ].join(" ")}
    >
      {children}
    </View>
  );
}

type BadgeTone = "sage" | "clay" | "sky" | "wheat" | "neutral";

const TONES: Record<BadgeTone, string> = {
  sage: "bg-sage-50 text-sage-700 border-sage-100",
  clay: "bg-clay-50 text-clay-700 border-clay-100",
  sky: "bg-sky-50 text-sky-700 border-sky-100",
  wheat: "bg-wheat-50 text-wheat-700 border-wheat-100",
  neutral: "bg-surface-sunk text-ink-soft border-line",
};

export function Badge({
  children,
  tone = "neutral",
  icon,
  className = "",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
}) {
  return (
    <View
      className={[
        "flex-row items-center gap-1 self-start rounded-full border px-2.5 py-1",
        TONES[tone],
        className,
      ].join(" ")}
    >
      {icon ? <Icon name={icon} size={12} className="opacity-80" /> : null}
      <Text className="text-[11px] font-semibold leading-4">{children}</Text>
    </View>
  );
}

/** Encabezado de sección con título, subtítulo y acciones a la derecha. */
export function SectionHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`flex-row items-end justify-between gap-3 ${className}`}>
      <View className="flex-1 gap-1">
        <Text className="text-lg font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="text-sm text-ink-muted">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
