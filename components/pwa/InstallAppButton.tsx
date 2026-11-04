import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { usePwaInstall } from "lib/pwa";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Logo } from "components/ui/Logo";

export function InstallAppButton({
  variant = "compact",
}: {
  variant?: "compact" | "sidebar";
}) {
  const { isWeb, isInstalled, canPromptNatively, isIos, triggerNativePrompt } =
    usePwaInstall();
  const [modalVisible, setModalVisible] = useState(false);

  if (!isWeb || isInstalled) {
    return null;
  }

  const handlePress = async () => {
    if (canPromptNatively) {
      const result = await triggerNativePrompt();
      if (result === "accepted") {
        showToast("¡Aplicación instalada en tu pantalla de inicio!", "success");
        return;
      }
      if (result === "dismissed") {
        return;
      }
    }
    setModalVisible(true);
  };

  return (
    <>
      {variant === "sidebar" ? (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Instalar aplicación en el dispositivo"
          className="mb-2.5 flex-row items-center justify-center gap-2 rounded-2xl border border-sage-600 bg-sage-50 px-4 py-2.5 active:bg-sage-100 cursor-pointer"
        >
          <Icon name="plus" size={16} className="text-sage-700" />
          <Text className="text-xs font-extrabold text-sage-800">
            Descargar App (Acceso directo)
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel="Instalar aplicación en mi celular"
          className="flex-row items-center gap-1.5 rounded-xl border border-sage-600 bg-sage-600 px-2.5 py-1.5 active:bg-sage-700 cursor-pointer"
        >
          <Icon name="plus" size={13} className="text-white" />
          <Text className="text-[11px] font-extrabold text-white">
            Instalar App
          </Text>
        </Pressable>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 p-4">
          <View className="w-full max-w-md gap-4 rounded-3xl border border-line bg-surface p-5 shadow-xl">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Logo size={42} />
                <View>
                  <Text className="text-base font-extrabold text-ink">
                    Instalar Mercado Ganadero
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    Acceso directo en la pantalla de tu celular
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                className="h-8 w-8 items-center justify-center rounded-full bg-surface-soft active:bg-surface-sunk cursor-pointer"
              >
                <Icon name="x" size={16} className="text-ink-soft" />
              </Pressable>
            </View>

            <Text className="text-xs leading-5 text-ink-soft">
              Podés agregar <Text className="font-bold text-ink">Mercado Ganadero (MEGA)</Text> a la
              pantalla de inicio de tu teléfono para abrirla a pantalla completa igual que una
              aplicación nativa, sin ocupar espacio extra:
            </Text>

            {isIos ? (
              <View className="gap-2.5 rounded-2xl border border-sage-200 bg-sage-50/70 p-3.5">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-sage-800">
                  En iPhone / iPad (Safari):
                </Text>
                <View className="flex-row items-start gap-2.5">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-sage-600">
                    <Text className="text-[11px] font-bold text-white">1</Text>
                  </View>
                  <Text className="flex-1 text-xs text-ink">
                    Tocá el botón <Text className="font-bold">Compartir</Text> (el ícono cuadrado con
                    una flecha hacia arriba en la barra de Safari).
                  </Text>
                </View>
                <View className="flex-row items-start gap-2.5">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-sage-600">
                    <Text className="text-[11px] font-bold text-white">2</Text>
                  </View>
                  <Text className="flex-1 text-xs text-ink">
                    Deslizá hacia abajo y elegí{" "}
                    <Text className="font-bold">&quot;Agregar a inicio&quot;</Text> y luego{" "}
                    <Text className="font-bold">&quot;Agregar&quot;</Text>.
                  </Text>
                </View>
              </View>
            ) : (
              <View className="gap-2.5 rounded-2xl border border-sage-200 bg-sage-50/70 p-3.5">
                <Text className="text-xs font-extrabold uppercase tracking-wider text-sage-800">
                  En Android (Chrome / Samsung Internet):
                </Text>
                <View className="flex-row items-start gap-2.5">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-sage-600">
                    <Text className="text-[11px] font-bold text-white">1</Text>
                  </View>
                  <Text className="flex-1 text-xs text-ink">
                    Tocá el menú de los <Text className="font-bold">3 puntos (⋮)</Text> arriba a la
                    derecha en tu navegador.
                  </Text>
                </View>
                <View className="flex-row items-start gap-2.5">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-sage-600">
                    <Text className="text-[11px] font-bold text-white">2</Text>
                  </View>
                  <Text className="flex-1 text-xs text-ink">
                    Seleccioná{" "}
                    <Text className="font-bold">&quot;Instalar aplicación&quot;</Text> o{" "}
                    <Text className="font-bold">
                      &quot;Agregar a la pantalla principal&quot;
                    </Text>
                    .
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              onPress={() => setModalVisible(false)}
              className="items-center justify-center rounded-2xl bg-sage-600 py-3 active:bg-sage-700 cursor-pointer"
            >
              <Text className="text-xs font-extrabold text-white">Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
