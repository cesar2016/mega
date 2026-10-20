import React from "react";
import { Image, Text, View } from "react-native";
import { Icon } from "./Icon";

/**
 * Portada de una publicación: la imagen elegida por el productor. Si el lote
 * no tiene fotos, muestra un placeholder con la categoría.
 */
export function MediaCover({
  url,
  categoria,
  className = "",
  iconSize = 26,
  rounded = "rounded-2xl",
}: {
  url?: string | null;
  categoria?: string | null;
  className?: string;
  iconSize?: number;
  rounded?: string;
}) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        accessibilityIgnoresInvertColors
        className={`w-full bg-surface-sunk ${rounded} ${className}`}
      />
    );
  }

  return (
    <View
      className={[
        "w-full items-center justify-center gap-1 bg-sage-50",
        rounded,
        className,
      ].join(" ")}
    >
      <Icon name="beef" size={iconSize} className="text-sage-400" />
      {categoria ? (
        <Text className="px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-sage-600">
          {categoria}
        </Text>
      ) : null}
    </View>
  );
}
