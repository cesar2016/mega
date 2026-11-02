import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { deleteOferta, useOfertasPorProductor } from "lib/hooks/useOfferDB";
import { useMisOperaciones } from "lib/hooks/useOperaciones";
import { useResponsive } from "lib/hooks/useResponsive";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { useAuthRedirect } from "lib/hooks/useAuthRedirect";
import { Icon } from "components/ui/Icon";
import { EmptyState } from "components/ui/Avatar";
import { Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { OfferCard } from "features/offers/OfferCard";
import type { OfertaResumen } from "features/offers/OfferCard";
import { OperacionCard } from "features/operations/OperacionCard";

type TabTipo = "publicaciones" | "ventas" | "compras";

/**
 * Centro de gestión comercial:
 * - Mis publicaciones (lotes creados por el usuario)
 * - Mis ventas (lotes vendidos con datos de contacto del comprador)
 * - Mis compras (lotes comprados con datos de contacto del productor)
 */
export default function OfertasScreen() {
  const redirect = useAuthRedirect({ returnUrl: "/(main)/tabs/ofertas" });
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ tab?: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { width } = useResponsive();

  const [tabActiva, setTabActiva] = useState<TabTipo>(
    searchParams.tab === "ventas" || searchParams.tab === "compras"
      ? (searchParams.tab as TabTipo)
      : "publicaciones"
  );

  useEffect(() => {
    if (searchParams.tab === "ventas" || searchParams.tab === "compras" || searchParams.tab === "publicaciones") {
      setTabActiva(searchParams.tab as TabTipo);
    }
  }, [searchParams.tab]);

  const columns = width >= 1280 ? 3 : width >= 640 ? 2 : 1;

  // 1. Consultar ofertas del productor
  const {
    data: dataOfertas,
    isLoading: loadingOfertas,
    error: errorOfertas,
    refetch: refetchOfertas,
    isRefetching: refetchingOfertas,
  } = useOfertasPorProductor(user?.id ?? "");

  // 2. Consultar operaciones (ventas y compras con contraparte)
  const {
    data: dataOperaciones,
    isLoading: loadingOperaciones,
    error: errorOperaciones,
    refetch: refetchOperaciones,
    isRefetching: refetchingOperaciones,
  } = useMisOperaciones(user?.id);

  if (redirect) return redirect;

  const irAPublicar = () => router.push("/(main)/oferta-nueva");
  const irAlDetalle = (id: string) => router.push(`/(main)/oferta/${id}`);
  const irAEditar = (id: string) =>
    router.push({ pathname: "/(main)/oferta-nueva", params: { id } });

  const handleEliminar = async (oferta: OfertaResumen) => {
    try {
      const urls = (oferta.oferta_media ?? []).map((m) => m.url);
      await deleteOferta(oferta.id, urls);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ofertas_activas"] }),
        queryClient.invalidateQueries({ queryKey: ["ofertas_vendidas"] }),
        queryClient.invalidateQueries({ queryKey: ["ofertas_productor"] }),
        queryClient.invalidateQueries({ queryKey: ["matches"] }),
        queryClient.invalidateQueries({ queryKey: ["oferta", oferta.id] }),
      ]);
      showToast("Publicación eliminada correctamente", "success");
    } catch (err: any) {
      console.error("Error al eliminar oferta:", err);
      showToast(err?.message || "No se pudo eliminar la publicación", "error");
    }
  };

  const refetch = async () => {
    await Promise.all([refetchOfertas(), refetchOperaciones()]);
  };
  const isRefetching = refetchingOfertas || refetchingOperaciones;
  const isLoading = loadingOfertas || loadingOperaciones;
  const error = errorOfertas || errorOperaciones;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando tus operaciones y ofertas...</Text>
      </View>
    );
  }

  const listaPublicaciones = (dataOfertas ?? []) as OfertaResumen[];
  const listaVentas = dataOperaciones?.ventas ?? [];
  const listaCompras = dataOperaciones?.compras ?? [];

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Mis ofertas y operaciones" action onActionPress={irAPublicar} />

      <Screen
        eyebrow="Gestión comercial"
        title={
          tabActiva === "ventas"
            ? "Mis ventas concretadas"
            : tabActiva === "compras"
              ? "Mis compras de hacienda"
              : "Mis publicaciones"
        }
        subtitle={
          tabActiva === "ventas"
            ? "Lotes que vendiste a través de la plataforma, con los datos personales y de contacto del comprador para coordinar entrega y cobro."
            : tabActiva === "compras"
              ? "Lotes que compraste en Mercado Ganadero, con los datos del productor y establecimiento para coordinar pago y traslado."
              : "Gestioná los lotes que publicaste para la venta: podés editarlos, actualizar sus fotos o eliminarlos."
        }
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          <Button
            label="Publicar oferta"
            icon="plus"
            onPress={irAPublicar}
            className="hidden md:flex"
          />
        }
      >
        {/* Selector de pestañas: Mis publicaciones / Mis ventas / Mis compras */}
        <View className="flex-row items-center gap-2 rounded-2xl bg-surface-soft p-1.5 border border-line-soft">
          <Pressable
            onPress={() => setTabActiva("publicaciones")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabActiva === "publicaciones" }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2.5 px-2.5 sm:px-3 transition-all cursor-pointer ${
              tabActiva === "publicaciones"
                ? "bg-surface shadow-xs border border-line"
                : "opacity-70 active:opacity-100"
            }`}
          >
            <Icon
              name="boxes"
              size={15}
              className={tabActiva === "publicaciones" ? "text-sage-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tabActiva === "publicaciones" ? "text-ink" : "text-ink-muted"
              }`}
            >
              Publicaciones ({listaPublicaciones.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTabActiva("ventas")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabActiva === "ventas" }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2.5 px-2.5 sm:px-3 transition-all cursor-pointer ${
              tabActiva === "ventas"
                ? "bg-surface shadow-xs border border-line"
                : "opacity-70 active:opacity-100"
            }`}
          >
            <Icon
              name="tag"
              size={15}
              className={tabActiva === "ventas" ? "text-amber-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tabActiva === "ventas" ? "text-amber-800" : "text-ink-muted"
              }`}
            >
              Mis ventas ({listaVentas.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTabActiva("compras")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabActiva === "compras" }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2.5 px-2.5 sm:px-3 transition-all cursor-pointer ${
              tabActiva === "compras"
                ? "bg-surface shadow-xs border border-line"
                : "opacity-70 active:opacity-100"
            }`}
          >
            <Icon
              name="shoppingCart"
              size={15}
              className={tabActiva === "compras" ? "text-sage-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tabActiva === "compras" ? "text-sage-800" : "text-ink-muted"
              }`}
            >
              Mis compras ({listaCompras.length})
            </Text>
          </Pressable>
        </View>

        {error ? (
          <EmptyState
            icon="cloudOff"
            title="No pudimos cargar la información"
            description={String((error as Error)?.message ?? error)}
            action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
          />
        ) : tabActiva === "publicaciones" ? (
          listaPublicaciones.length === 0 ? (
            <EmptyState
              icon="boxes"
              title="Todavía no publicaste ninguna oferta"
              description="Publicá tu primer lote y el matching automático lo cruza con las demandas activas del mercado."
              action={<Button label="Publicar oferta" icon="plus" onPress={irAPublicar} />}
            />
          ) : (
            <Grid columns={columns}>
              {listaPublicaciones.map((oferta) => {
                const esVendida =
                  oferta.estado === "vendida" || oferta.estado === "completada";
                return (
                  <OfferCard
                    key={oferta.id}
                    oferta={oferta}
                    onPress={() => irAlDetalle(oferta.id)}
                    onEdit={!esVendida ? () => irAEditar(oferta.id) : undefined}
                    onDelete={!esVendida ? () => handleEliminar(oferta) : undefined}
                  />
                );
              })}
            </Grid>
          )
        ) : tabActiva === "ventas" ? (
          listaVentas.length === 0 ? (
            <EmptyState
              icon="tag"
              title="Todavía no registrás ventas"
              description="Cuando un comprador confirme la adquisición de uno de tus lotes, verás aquí la operación y todos los datos de contacto directos del comprador."
            />
          ) : (
            <View className="gap-4">
              {listaVentas.map((operacion) => (
                <OperacionCard key={operacion.id} operacion={operacion} tipo="venta" />
              ))}
            </View>
          )
        ) : (
          listaCompras.length === 0 ? (
            <EmptyState
              icon="shoppingCart"
              title="Todavía no realizaste compras"
              description="Explorá los lotes activos en el mercado. Al confirmar una compra, verás aquí el registro del lote y los datos de contacto del productor para coordinar el retiro."
              action={<Button label="Explorar lotes en el mercado" icon="store" onPress={() => router.push("/")} />}
            />
          ) : (
            <View className="gap-4">
              {listaCompras.map((operacion) => (
                <OperacionCard key={operacion.id} operacion={operacion} tipo="compra" />
              ))}
            </View>
          )
        )}

        <Card className="flex-row items-center gap-4" padded>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-clay-50">
            <Icon name="truck" size={20} className="text-clay-500" />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-ink">¿Buscás un flete?</Text>
            <Text className="text-xs leading-5 text-ink-muted">
              Los transportistas con cobertura en tu provincia ven automáticamente tus lotes activos.
            </Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-sage-50">
            <Icon name="handshake" size={20} className="text-sage-600" />
          </View>
        </Card>
      </Screen>
    </View>
  );
}
