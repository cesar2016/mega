import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { shouldAutoShowPwaSheet, usePwaInstall } from "lib/pwa";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";

/**
 * Botón en la barra superior (móvil) o barra lateral (escritorio):
 * Dice "Descargar App" y lanza la descarga/instalación directa de la PWA.
 */
export function InstallAppButton({
  variant = "compact",
}: {
  variant?: "compact" | "sidebar";
}) {
  const { isWeb, isInstalled, canPromptNatively, triggerNativePrompt, openSheet } =
    usePwaInstall();
  const [instalando, setInstalando] = useState(false);

  if (!isWeb || isInstalled) {
    return null;
  }

  const handlePress = async () => {
    if (canPromptNatively) {
      setInstalando(true);
      const res = await triggerNativePrompt();
      setInstalando(false);
      if (res === "accepted") {
        showToast("¡App descargada en tu celular!", "success");
        return;
      }
      if (res === "dismissed") {
        return;
      }
    }
    openSheet();
  };

  if (variant === "sidebar") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={instalando}
        accessibilityRole="button"
        accessibilityLabel="Descargar App"
        className="mb-2.5 flex-row items-center justify-center gap-2 rounded-2xl border border-sage-600 bg-sage-50 px-4 py-2.5 active:bg-sage-100 cursor-pointer"
      >
        {instalando ? (
          <ActivityIndicator size="small" className="text-sage-700" />
        ) : (
          <Icon name="plus" size={16} className="text-sage-700" />
        )}
        <Text className="text-xs font-extrabold text-sage-800">
          Descargar App
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={instalando}
      accessibilityRole="button"
      accessibilityLabel="Descargar App"
      className="flex-row items-center gap-1.5 rounded-xl border border-sage-600 bg-sage-600 px-2.5 py-1.5 active:bg-sage-700 cursor-pointer"
    >
      {instalando ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Icon name="plus" size={13} className="text-white" />
      )}
      <Text className="text-[11px] font-extrabold text-white">
        Descargar App
      </Text>
    </Pressable>
  );
}

/**
 * Cuadro inferior estilo Bottom Sheet:
 * - "Guardá Mercado Ganadero en tu celular"
 * - "Accedé rápidamente a los lotes y ofertas desde tu teléfono."
 * - [ Descargar App > ]
 * - [ Lo haré más adelante ]
 * - "No volver a mostrar"
 */
export function PwaInstallSheet() {
  const {
    isWeb,
    isInstalled,
    isIos,
    sheetOpenManual,
    triggerNativePrompt,
    closeSheet,
  } = usePwaInstall();

  const [autoVisible, setAutoVisible] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const [mostrarAyudaFallback, setMostrarAyudaFallback] = useState(false);

  useEffect(() => {
    if (!isWeb || isInstalled) return;
    const timer = setTimeout(() => {
      if (shouldAutoShowPwaSheet()) {
        setAutoVisible(true);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [isWeb, isInstalled]);

  if (!isWeb || isInstalled) {
    return null;
  }

  const visible = sheetOpenManual || autoVisible;
  if (!visible) {
    return null;
  }

  const handleCloseLater = () => {
    setAutoVisible(false);
    setMostrarAyudaFallback(false);
    closeSheet("later");
  };

  const handleNeverShowAgain = () => {
    setAutoVisible(false);
    setMostrarAyudaFallback(false);
    closeSheet("never");
  };

  const handleInstallClick = async () => {
    setInstalando(true);
    const outcome = await triggerNativePrompt();
    setInstalando(false);

    if (outcome === "accepted") {
      setAutoVisible(false);
      setMostrarAyudaFallback(false);
      closeSheet("never");
      showToast("¡App descargada en tu celular!", "success");
      return;
    }

    if (outcome === "dismissed") {
      handleCloseLater();
      return;
    }

    // Si el navegador aún no habilitó el disparo automático (ej. Safari en iOS)
    setMostrarAyudaFallback(true);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCloseLater}
    >
      <View className="flex-1 justify-end bg-black/45">
        <View className="w-full max-w-lg self-center rounded-t-[28px] bg-white px-6 pb-7 pt-5 shadow-2xl">
          {/* Botón cerrar arriba a la derecha */}
          <View className="flex-row items-center justify-end">
            <Pressable
              onPress={handleCloseLater}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 cursor-pointer"
            >
              <Icon name="x" size={18} className="text-slate-500" />
            </Pressable>
          </View>

          {/* Ícono central de celular en recuadro redondeado */}
          <View className="-mt-2 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-sage-700 shadow-md">
              <View className="h-8 w-5 items-center justify-end rounded-[4px] border-2 border-white pb-1">
                <View className="h-1 w-1 rounded-full bg-white" />
              </View>
            </View>

            <Text className="text-center text-lg font-extrabold text-sage-900">
              Guardá Mercado Ganadero en tu celular
            </Text>
            <Text className="mt-1.5 text-center text-sm text-slate-500">
              Accedé rápidamente a los lotes y ofertas desde tu teléfono.
            </Text>
          </View>

          {mostrarAyudaFallback ? (
            <View className="mt-4 rounded-2xl border border-sage-200 bg-sage-50 p-3.5">
              <Text className="text-center text-xs leading-5 text-sage-900">
                {isIos
                  ? 'En iPhone (Safari): tocá el ícono "Compartir" en la barra inferior y seleccioná "Agregar a inicio".'
                  : 'Si tu navegador no abrió la descarga directa, tocá los 3 puntos (⋮) arriba a la derecha y elegí "Instalar aplicación".'}
              </Text>
            </View>
          ) : null}

          {/* Botón principal: Descargar App > */}
          <Pressable
            onPress={handleInstallClick}
            disabled={instalando}
            accessibilityRole="button"
            className="mt-6 flex-row items-center justify-center gap-2 rounded-full bg-sage-700 py-4 shadow-sm active:bg-sage-800 cursor-pointer"
          >
            {instalando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text className="text-sm font-extrabold text-white">
                  Descargar App
                </Text>
                <Icon name="chevronRight" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>

          {/* Botón secundario: Lo haré más adelante */}
          <Pressable
            onPress={handleCloseLater}
            accessibilityRole="button"
            className="mt-3 items-center justify-center rounded-full border border-slate-200 bg-white py-3.5 active:bg-slate-50 cursor-pointer"
          >
            <Text className="text-sm font-bold text-sage-800">
              Lo haré más adelante
            </Text>
          </Pressable>

          {/* Enlace inferior: No volver a mostrar */}
          <Pressable
            onPress={handleNeverShowAgain}
            accessibilityRole="button"
            className="mt-4 items-center py-1 cursor-pointer"
          >
            <Text className="text-xs font-semibold text-slate-500">
              No volver a mostrar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
