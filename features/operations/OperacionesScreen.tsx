import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMisOperaciones } from "lib/hooks/useOperaciones";
import { useAuthStore } from "store/authStore";
import { useAuthRedirect } from "lib/hooks/useAuthRedirect";
import { Icon } from "components/ui/Icon";
import { EmptyState } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { OperacionCard } from "./OperacionCard";

type TabOperacion = "compras" | "ventas" | "todas";

export default function OperacionesScreen() {
  const redirect = useAuthRedirect({ returnUrl: "/(main)/tabs/operaciones" });
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const user = useAuthStore((state) => state.user);

  const [tab, setTab] = useState<TabOperacion>(
    params.tab === "ventas" || params.tab === "todas"
      ? (params.tab as TabOperacion)
      : "compras"
  );

  useEffect(() => {
    if (params.tab === "compras" || params.tab === "ventas" || params.tab === "todas") {
      setTab(params.tab as TabOperacion);
    }
  }, [params.tab]);

  const { data, isLoading, error, refetch, isRefetching } = useMisOperaciones(user?.id);

  if (redirect) return redirect;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando tus compras y ventas...</Text>
      </View>
    );
  }

  const compras = data?.compras ?? [];
  const ventas = data?.ventas ?? [];
  const todas = data?.todas ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Mis Compras y Ventas" />

      <Screen
        eyebrow="Operaciones confirmadas"
        title={
          tab === "compras"
            ? "Mis Compras"
            : tab === "ventas"
              ? "Mis Ventas"
              : "Mis Compras y Ventas"
        }
        subtitle="Consultá el detalle de cada lote comercializado y los datos directos de contacto de la contraparte."
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          <View className="hidden flex-row items-center gap-2 md:flex">
            {compras.length > 0 ? (
              <Badge tone="sage" icon="shoppingCart">
                {`${compras.length} ${compras.length === 1 ? "Compra concretada" : "Compras concretadas"}`}
              </Badge>
            ) : null}
            {ventas.length > 0 ? (
              <Badge tone="clay" icon="tag">
                {`${ventas.length} ${ventas.length === 1 ? "Venta concretada" : "Ventas concretadas"}`}
              </Badge>
            ) : null}
          </View>
        }
      >
        {/* Resumen superior con Badges de estado */}
        <View className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Pressable
            onPress={() => setTab("compras")}
            className={[
              "flex-row items-center justify-between rounded-2xl border p-4 cursor-pointer",
              tab === "compras"
                ? "border-sage-400 bg-sage-50"
                : "border-line-soft bg-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-sage-100">
                <Icon name="shoppingCart" size={20} className="text-sage-700" />
              </View>
              <View className="gap-0.5">
                <Text className="text-sm font-extrabold text-ink">Mis Compras</Text>
                <Text className="text-xs text-ink-muted">
                  Lotes adquiridos y datos del vendedor
                </Text>
              </View>
            </View>
            <Badge tone={compras.length > 0 ? "sage" : "neutral"} icon="checkCircle">
              {`${compras.length}`}
            </Badge>
          </Pressable>

          <Pressable
            onPress={() => setTab("ventas")}
            className={[
              "flex-row items-center justify-between rounded-2xl border p-4 cursor-pointer",
              tab === "ventas"
                ? "border-clay-400 bg-clay-50"
                : "border-line-soft bg-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-amber-100">
                <Icon name="tag" size={20} className="text-amber-800" />
              </View>
              <View className="gap-0.5">
                <Text className="text-sm font-extrabold text-ink">Mis Ventas</Text>
                <Text className="text-xs text-ink-muted">
                  Lotes vendidos y datos del comprador
                </Text>
              </View>
            </View>
            <Badge tone={ventas.length > 0 ? "clay" : "neutral"} icon="checkCircle">
              {`${ventas.length}`}
            </Badge>
          </Pressable>
        </View>

        {/* Selector de pestañas con Badges */}
        <View className="flex-row items-center gap-2 rounded-2xl border border-line-soft bg-surface-soft p-1.5">
          <Pressable
            onPress={() => setTab("compras")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "compras" }}
            className={[
              "flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 cursor-pointer",
              tab === "compras" ? "bg-surface shadow-xs border border-line" : "opacity-75",
            ].join(" ")}
          >
            <Icon
              name="shoppingCart"
              size={15}
              className={tab === "compras" ? "text-sage-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tab === "compras" ? "text-sage-800" : "text-ink-muted"
              }`}
            >
              Mis Compras
            </Text>
            {compras.length > 0 ? (
              <Badge tone="sage">{compras.length}</Badge>
            ) : (
              <Text className="text-xs font-semibold text-ink-muted">(0)</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setTab("ventas")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "ventas" }}
            className={[
              "flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 cursor-pointer",
              tab === "ventas" ? "bg-surface shadow-xs border border-line" : "opacity-75",
            ].join(" ")}
          >
            <Icon
              name="tag"
              size={15}
              className={tab === "ventas" ? "text-amber-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tab === "ventas" ? "text-amber-800" : "text-ink-muted"
              }`}
            >
              Mis Ventas
            </Text>
            {ventas.length > 0 ? (
              <Badge tone="clay">{ventas.length}</Badge>
            ) : (
              <Text className="text-xs font-semibold text-ink-muted">(0)</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setTab("todas")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "todas" }}
            className={[
              "flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 cursor-pointer",
              tab === "todas" ? "bg-surface shadow-xs border border-line" : "opacity-75",
            ].join(" ")}
          >
            <Icon
              name="handshake"
              size={15}
              className={tab === "todas" ? "text-ink" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tab === "todas" ? "text-ink" : "text-ink-muted"
              }`}
            >
              Todas
            </Text>
            {todas.length > 0 ? (
              <Badge tone="wheat">{todas.length}</Badge>
            ) : (
              <Text className="text-xs font-semibold text-ink-muted">(0)</Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <EmptyState
            icon="cloudOff"
            title="No pudimos cargar tus operaciones"
            description={String((error as Error)?.message ?? error)}
            action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
          />
        ) : tab === "compras" ? (
          compras.length === 0 ? (
            <EmptyState
              icon="shoppingCart"
              title="Todavía no registrás compras"
              description="Cuando confirmes la compra de un lote en el mercado, aparecerá acá con el Badge de compra confirmada y todos los datos del vendedor."
              action={
                <Button
                  label="Ver lotes disponibles"
                  icon="store"
                  onPress={() => router.push("/")}
                />
              }
            />
          ) : (
            <View className="gap-4">
              {compras.map((op) => (
                <OperacionCard key={op.id} operacion={op} tipo="compra" />
              ))}
            </View>
          )
        ) : tab === "ventas" ? (
          ventas.length === 0 ? (
            <EmptyState
              icon="tag"
              title="Todavía no registrás ventas"
              description="Cuando un comprador adquiera uno de tus lotes, verás acá la operación con su Badge de venta concretada y los datos del comprador."
              action={
                <Button
                  label="Publicar un lote"
                  icon="plus"
                  onPress={() => router.push("/(main)/oferta-nueva")}
                />
              }
            />
          ) : (
            <View className="gap-4">
              {ventas.map((op) => (
                <OperacionCard key={op.id} operacion={op} tipo="venta" />
              ))}
            </View>
          )
        ) : todas.length === 0 ? (
          <EmptyState
            icon="handshake"
            title="Sin operaciones registradas"
            description="Tus compras y ventas concretadas en Mercado Ganadero se mostrarán en esta sección."
            action={
              <Button
                label="Ir al mercado"
                icon="store"
                onPress={() => router.push("/")}
              />
            }
          />
        ) : (
          <View className="gap-4">
            {todas.map((op) => (
              <OperacionCard
                key={op.id}
                operacion={op}
                tipo={op.vendedor_id === user?.id ? "venta" : "compra"}
              />
            ))}
          </View>
        )}

        <Card className="flex-row items-center gap-4" padded>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-sage-50">
            <Icon name="mail" size={20} className="text-sage-600" />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-ink">
              Notificación automática por correo
            </Text>
            <Text className="text-xs leading-5 text-ink-muted">
              Al concretarse una compra o venta, tanto comprador como vendedor reciben un correo desde mganadero.ok@gmail.com con todos los datos de contacto.
            </Text>
          </View>
        </Card>
      </Screen>
    </View>
  );
}
