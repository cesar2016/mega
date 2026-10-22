import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { deleteOferta, useOfertasActivas } from "lib/hooks/useOfferDB";
import { isSupabaseConfigured } from "lib/supabase";
import { useResponsive } from "lib/hooks/useResponsive";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { EmptyState } from "components/ui/Avatar";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { OfferCard } from "features/offers/OfferCard";
import type { OfertaResumen } from "features/offers/OfferCard";

export default function FeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const { width } = useResponsive();

  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;

  // El marketplace es visible para todos los roles (el fletero también puede
  // ver lotes para ofertar flete).
  const { data: ofertas, isLoading, error, refetch, isRefetching } = useOfertasActivas({
    enabled: !!profile,
  });

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

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando perfil...</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Buscando lotes en el mercado...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <Screen title="No pudimos cargar las ofertas" subtitle="Revisá tu conexión e intentá de nuevo.">
        <EmptyState
          icon="cloudOff"
          title="Error de conexión"
          description={String((error as Error)?.message ?? error)}
          action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
        />
      </Screen>
    );
  }

  const lista = (ofertas ?? []) as OfertaResumen[];

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Ofertas" action onActionPress={irAPublicar} />

      <Screen
        eyebrow="Mercado ganadero"
        title="Lotes disponibles"
        subtitle="Ofertas activas de productores verificados en todo el país. Conectá directo y cerrá el trato."
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          <Button label="Publicar oferta" icon="plus" onPress={irAPublicar} className="hidden md:flex" />
        }
      >
        <Gradient
          colors={["#DCFCE7", "#E0F2FE", "#FDF8F5"]}
          className="flex-col gap-4 rounded-3xl border border-line-soft px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7"
        >
          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-surface/80">
                <Icon name="flame" size={16} className="text-clay-500" />
              </View>
              <Text className="text-sm font-bold text-ink">Demanda en vivo</Text>
            </View>
            <Text className="text-2xl font-extrabold tracking-tight text-ink">
              {lista.length} {lista.length === 1 ? "oferta activa" : "ofertas activas"}
            </Text>
            <Text className="max-w-2xl text-sm text-ink-soft">
              El matching automático cruza tu búsqueda con los lotes publicados por productores.
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-2 lg:shrink-0">
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="shield" size={14} className="text-sage-600" />
              <Text className="text-xs font-semibold text-ink-soft">Productores verificados</Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="handshake" size={14} className="text-clay-500" />
              <Text className="text-xs font-semibold text-ink-soft">Match automático</Text>
            </View>
          </View>
        </Gradient>

        {!isSupabaseConfigured ? (
          <EmptyState
            icon="cloudOff"
            title="Modo demo: sin ofertas para mostrar"
            description="Configurá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env para conectar con tu proyecto de Supabase."
          />
        ) : lista.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Todavía no hay ofertas activas"
            description="Sé el primero en publicar un lote y aparecé en el mercado."
            action={<Button label="Publicar oferta" icon="plus" onPress={irAPublicar} />}
          />
        ) : (
          <Grid columns={columns}>
            {lista.map((oferta) => {
              const esPropia = Boolean(profile?.id && oferta.productor_id === profile.id);
              return (
                <OfferCard
                  key={oferta.id}
                  oferta={oferta}
                  onPress={() => irAlDetalle(oferta.id)}
                  onEdit={esPropia ? () => irAEditar(oferta.id) : undefined}
                  onDelete={esPropia ? () => handleEliminar(oferta) : undefined}
                />
              );
            })}
          </Grid>
        )}
      </Screen>
    </View>
  );
}

