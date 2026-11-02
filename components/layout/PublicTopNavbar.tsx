import React from "react";
import { Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useResponsive } from "lib/hooks/useResponsive";
import { Button } from "components/ui/Button";
import { Icon } from "components/ui/Icon";
import { Logo } from "components/ui/Logo";

/**
 * Barra de navegación superior permanente para visitantes no autenticados.
 * Permanece fija en la parte superior tanto en el feed como al visualizar publicaciones.
 */
export function PublicTopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useResponsive();

  const esDetalle = pathname.includes("/oferta/");
  const returnUrl = pathname || "/";

  const handleVolver = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <View className="z-30 shrink-0 flex-row items-center justify-between border-b border-line-soft bg-surface/95 backdrop-blur-sm px-3 py-2.5 sm:px-4 sm:py-3 md:px-8">
      <View className="flex-row items-center gap-2 sm:gap-3">
        {esDetalle ? (
          <Pressable
            onPress={handleVolver}
            accessibilityRole="button"
            accessibilityLabel="Volver al listado"
            className="h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface active:bg-surface-sunk cursor-pointer"
          >
            <Icon name="arrowLeft" size={18} className="text-ink-soft" />
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.push("/")}
          className="flex-row items-center gap-2 sm:gap-3 active:opacity-80 cursor-pointer"
          accessibilityRole="button"
          accessibilityLabel="Ir al inicio"
        >
          <Logo size={width < 400 ? 34 : 40} className="rounded-full shadow-sm" />
          <View>
            <Text className="text-sm sm:text-base font-bold text-ink">Mercado Ganadero</Text>
            {width >= 640 ? (
              <Text className="text-xs text-ink-muted">Compra y venta de hacienda</Text>
            ) : null}
          </View>
        </Pressable>
      </View>

      <View className="flex-row items-center gap-1.5 sm:gap-2">
        <Button
          label={width < 500 ? "Registro" : "Registrarme gratis"}
          icon={width < 400 ? undefined : "userPlus"}
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/auth",
              params: { mode: "registro", returnUrl },
            })
          }
        />
        <Button
          label={width < 500 ? "Entrar" : "Iniciar sesión"}
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/auth",
              params: { mode: "login", returnUrl },
            })
          }
        />
      </View>
    </View>
  );
}
