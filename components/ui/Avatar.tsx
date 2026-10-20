import React from "react";
import { Image, Text, View } from "react-native";
import { Icon } from "./Icon";
import type { IconName } from "./Icon.types";

/** Avatar circular con imagen o iniciales. */
export function Avatar({
  uri,
  nombre,
  size = 40,
  className = "",
}: {
  uri?: string | null;
  nombre?: string | null;
  size?: number;
  className?: string;
}) {
  const iniciales = (nombre ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className={`bg-surface-sunk ${className}`}
      />
    );
  }

  return (
    <View
      className={`items-center justify-center rounded-full bg-sage-100 ${className}`}
      style={{ width: size, height: size }}
    >
      <Text className="font-bold text-sage-700" style={{ fontSize: size * 0.38 }}>
        {iniciales || "?"}
      </Text>
    </View>
  );
}

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <View
      className={[
        "items-center gap-3 rounded-3xl border border-dashed border-line bg-surface/70 px-6 py-10",
        className,
      ].join(" ")}
    >
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-sage-50">
        <Icon name={icon} size={24} className="text-sage-500" />
      </View>
      <Text className="text-center text-base font-semibold text-ink">{title}</Text>
      {description ? (
        <Text className="max-w-sm text-center text-sm leading-5 text-ink-muted">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-1">{action}</View> : null}
    </View>
  );
}
