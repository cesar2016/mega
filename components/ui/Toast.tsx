import React from "react";
import { Pressable, Text, View } from "react-native";
import { useToastStore } from "store/toastStore";
import type { ToastTone } from "store/toastStore";
import { Icon } from "./Icon";

const TONES: Record<ToastTone, { box: string; icon: string; iconName: "checkCircle" | "alert" | "info" }> = {
  success: { box: "bg-sage-50 border-sage-100", icon: "text-sage-600", iconName: "checkCircle" },
  error: { box: "bg-clay-50 border-clay-100", icon: "text-clay-600", iconName: "alert" },
  info: { box: "bg-sky-50 border-sky-100", icon: "text-sky-600", iconName: "info" },
};

/** Host de notificaciones: se monta una vez en el layout raíz. */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const remove = useToastStore((state) => state.remove);

  if (toasts.length === 0) return null;

  return (
    <View className="pointer-events-none absolute inset-x-0 top-0 z-50 items-center gap-2 px-4 pt-4 md:items-end md:px-6">
      {toasts.map((toast) => {
        const tone = TONES[toast.tone];
        return (
          <Pressable
            key={toast.id}
            onPress={() => remove(toast.id)}
            accessibilityRole="alert"
            className={`pointer-events-auto w-full max-w-sm flex-row items-center gap-3 rounded-2xl border px-4 py-3 shadow-card ${tone.box}`}
          >
            <Icon name={tone.iconName} size={18} className={tone.icon} />
            <Text className="flex-1 text-sm font-medium text-ink">{toast.message}</Text>
            <Icon name="x" size={14} className="text-ink-muted" />
          </Pressable>
        );
      })}
    </View>
  );
}
