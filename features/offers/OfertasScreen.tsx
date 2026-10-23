import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { deleteOferta, useOfertasPorProductor } from "lib/hooks/useOfferDB";
import { useResponsive } from "lib/hooks/useResponsive";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { EmptyState } from "components/ui/Avatar";
import { Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { OfferCard } from "features/offers/OfferCard";
import type { OfertaResumen } from "features/offers/OfferCard";

/**
 * Mis ofertas (productor). Lista las publicaciones del usuario autenticado
 * y permite editarlas o eliminarlas directamente.
 */
export default function OfertasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { width } = useResponsive();

  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;

  const { data, isLoading, error, refetch, isRefetching } = useOfertasPorProductor(user?.id ?? "");

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

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando tus ofertas...</Text>
      </View>
    );
  }

  const lista = (data ?? []) as OfertaResumen[];

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Mis ofertas" action onActionPress={irAPublicar} />

      <Screen
        eyebrow="Tus publicaciones"
        title="Mis ofertas"
        subtitle="Gestioná los lotes que publicaste para la venta: podés editarlos, actualizar sus fotos o eliminarlos."
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
        {error ? (
          <EmptyState
            icon="cloudOff"
            title="No pudimos cargar tus ofertas"
            description={String((error as Error)?.message ?? error)}
            action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
          />
        ) : lista.length === 0 ? (
          <EmptyState
            icon="boxes"
            title="Todavía no publicaste ninguna oferta"
            description="Publicá tu primer lote y el matching automático lo cruza con las demandas activas del mercado."
            action={<Button label="Publicar oferta" icon="plus" onPress={irAPublicar} />}
          />
        ) : (
          <Grid columns={columns}>
            {lista.map((oferta) => (
              <OfferCard
                key={oferta.id}
                oferta={oferta}
                onPress={() => irAlDetalle(oferta.id)}
                onEdit={() => irAEditar(oferta.id)}
                onDelete={() => handleEliminar(oferta)}
              />
            ))}
          </Grid>
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

