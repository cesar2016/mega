import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Icon } from "./Icon";
import type { IconName } from "./Icon.types";

type ButtonVariant = "primary" | "accent" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  testID?: string;
};

const VARIANTS: Record<ButtonVariant, { box: string; label: string; icon: string }> = {
  primary: {
    box: "bg-sage-500 border-sage-500 active:bg-sage-600",
    label: "text-white",
    icon: "text-white",
  },
  accent: {
    box: "bg-clay-500 border-clay-500 active:bg-clay-600",
    label: "text-white",
    icon: "text-white",
  },
  secondary: {
    box: "bg-surface border-line active:bg-surface-sunk",
    label: "text-ink",
    icon: "text-ink-soft",
  },
  soft: {
    box: "bg-sage-50 border-sage-100 active:bg-sage-100",
    label: "text-sage-700",
    icon: "text-sage-600",
  },
  ghost: {
    box: "bg-transparent border-transparent active:bg-surface-sunk",
    label: "text-sage-600",
    icon: "text-sage-600",
  },
  danger: {
    box: "bg-clay-600 border-clay-600 active:bg-clay-700",
    label: "text-white",
    icon: "text-white",
  },
};

const SIZES: Record<ButtonSize, { box: string; label: string; icon: number }> = {
  sm: { box: "px-3 py-1.5 rounded-xl gap-1.5", label: "text-xs", icon: 14 },
  md: { box: "px-4 py-2.5 rounded-2xl gap-2", label: "text-sm", icon: 16 },
  lg: { box: "px-5 py-3.5 rounded-2xl gap-2.5", label: "text-base", icon: 18 },
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  testID,
}: ButtonProps) {
  const tones = VARIANTS[variant];
  const dimensions = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      className={[
        "flex-row items-center justify-center border",
        dimensions.box,
        tones.box,
        fullWidth ? "w-full" : "",
        isDisabled ? "opacity-50" : "",
        className,
      ].join(" ")}
    >
      {loading ? (
        <ActivityIndicator size="small" className={tones.icon} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={dimensions.icon} className={tones.icon} /> : null}
          <Text className={`${dimensions.label} font-semibold ${tones.label}`}>{label}</Text>
          {iconRight ? (
            <Icon name={iconRight} size={dimensions.icon} className={tones.icon} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** Botón cuadrado sólo con icono (barra de acciones, chips, etc.). */
export function IconButton({
  name,
  onPress,
  className = "",
  iconClassName = "text-ink-soft",
  size = 20,
  disabled = false,
  label,
  testID,
}: {
  name: IconName;
  onPress?: () => void;
  className?: string;
  iconClassName?: string;
  size?: number;
  disabled?: boolean;
  label: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      className={[
        "items-center justify-center rounded-xl p-2 active:bg-surface-sunk",
        disabled ? "opacity-40" : "",
        className,
      ].join(" ")}
    >
      <Icon name={name} size={size} className={iconClassName} />
    </Pressable>
  );
}

/** Fila de acciones apiladas, adaptable a mobile / desktop. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-2">{children}</View>;
}
