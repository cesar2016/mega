import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useOfertasPorProductor } from "lib/hooks/useOfferDB";
import { useResponsive } from "lib/hooks/useResponsive";
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
 * Mis ofertas (productor). Lista las publicaciones del usuario autenticado.
 */
export default function OfertasScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { width } = useResponsive();

  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;

  const { data, isLoading, error, refetch, isRefetching } = useOfertasPorProductor(user?.id ?? "");

  const irAPublicar = () => router.push("/(main)/oferta-nueva");
  const irAlDetalle = (id: string) => router.push(`/(main)/oferta/${id}`);

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
        eyebrow="Panel del productor"
        title="Mis ofertas"
        subtitle="Gestioná los lotes que publicaste y seguí su estado en el mercado."
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
