import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { iniciarOAbrirConversacion } from "lib/hooks/useChat";
import { useDemandasActivas } from "lib/hooks/useDemandaDB";
import { useResponsive } from "lib/hooks/useResponsive";
import { isSupabaseConfigured } from "lib/supabase";
import { useAuthStore } from "store/authStore";
import { maskNombreUsuario, showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";

type Demanda = {
  id: string;
  comprador_id?: string | null;
  categoria: string;
  raza?: string | null;
  cantidad_min?: number | null;
  cantidad_max?: number | null;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
  precio_max?: number | null;
  tipo_precio?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  radio_km?: number | null;
  profiles?: { id?: string | null; nombre?: string | null; avatar_url?: string | null } | null;
};

function rangoPeso(demanda: Demanda) {
  const min = demanda.peso_min_kg;
  const max = demanda.peso_max_kg;
  if (min == null && max == null) return "Peso a definir";
  if (min != null && max != null) return `${min} – ${max} kg`;
  return `${min ?? max} kg`;
}

function rangoCantidad(demanda: Demanda) {
  const min = demanda.cantidad_min;
  const max = demanda.cantidad_max;
  if (min == null && max == null) return "Cantidad a definir";
  if (min != null && max != null) return `${min} – ${max} cab.`;
  return `${min ?? max} cab.`;
}

/**
 * Demandas de compra (comprador). Muestra las búsquedas activas del mercado.
 */
export default function DemandasScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const { width } = useResponsive();
  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useDemandasActivas({
    enabled: !!profile,
  });

  const contactarDemanda = async (item: Demanda) => {
    const esPropia = Boolean(
      profile?.id && (item.comprador_id === profile.id || item.profiles?.id === profile.id)
    );
    if (esPropia || !isSupabaseConfigured) {
      router.push("/(main)/tabs/chat");
      return;
    }

    const contraparteId = item.comprador_id ?? item.profiles?.id;
    if (!contraparteId) {
      showToast("No se pudo identificar al usuario de la demanda", "error");
      return;
    }

    try {
      setOcupadoId(item.id);
      const convId = await iniciarOAbrirConversacion({
        contraparteId,
        demandaId: item.id,
      });
      await queryClient.invalidateQueries({ queryKey: ["conversaciones"] });
      router.push({ pathname: "/(main)/tabs/chat", params: { id: convId } });
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "No se pudo abrir la consulta",
        "error"
      );
    } finally {
      setOcupadoId(null);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Buscando demandas activas...</Text>
      </View>
    );
  }

  const lista = (data ?? []) as Demanda[];

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Demandas" />

      <Screen
        eyebrow="Búsquedas de hacienda"
        title="Demandas activas"
        subtitle="Lo que el mercado está buscando comprar ahora. Cada demanda genera matches automáticos con los lotes publicados."
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          <Button
            label="Publicar demanda"
            icon="plus"
            onPress={() => showToast("La publicación de demandas llega en la próxima versión", "info")}
            className="hidden md:flex"
          />
        }
      >
        <Gradient
          colors={["#E1EAF0", "#F8E6DA", "#F4F2EC"]}
          className="flex-col gap-4 rounded-3xl border border-line-soft px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7"
        >
          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-surface/80">
                <Icon name="search" size={16} className="text-sky-500" />
              </View>
              <Text className="text-sm font-bold text-ink">Búsquedas abiertas</Text>
            </View>
            <Text className="text-2xl font-extrabold tracking-tight text-ink">
              {lista.length} {lista.length === 1 ? "demanda activa" : "demandas activas"}
            </Text>
            <Text className="max-w-2xl text-sm text-ink-soft">
              El matching cruza categoría, raza, peso, precio y radio de búsqueda.
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-2 lg:shrink-0">
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="mapPin" size={14} className="text-clay-500" />
              <Text className="text-xs font-semibold text-ink-soft">Radio en km</Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="coins" size={14} className="text-sage-600" />
              <Text className="text-xs font-semibold text-ink-soft">Precio máximo</Text>
            </View>
          </View>
        </Gradient>

        {error ? (
          <EmptyState
            icon="cloudOff"
            title="No pudimos cargar las demandas"
            description={String((error as Error)?.message ?? error)}
            action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
          />
        ) : !isSupabaseConfigured ? (
          <EmptyState
            icon="cloudOff"
            title="Modo demo: sin demandas para mostrar"
            description="Configurá las variables EXPO_PUBLIC_SUPABASE_* en .env para conectar con tu proyecto de Supabase."
          />
        ) : lista.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Todavía no hay demandas activas"
            description="Cuando un comprador publique una búsqueda, va a aparecer acá y a generar matches automáticos."
          />
        ) : (
          <Grid columns={columns}>
            {lista.map((item) => {
              const esPropia = Boolean(
                profile?.id && (item.comprador_id === profile.id || item.profiles?.id === profile.id)
              );

              return (
                <Card key={item.id} className="gap-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1 gap-2">
                      <Badge tone="sky" icon="shoppingCart">
                        {item.categoria?.toUpperCase() ?? "DEMANDA"}
                      </Badge>
                      <Text className="text-base font-bold text-ink" numberOfLines={1}>
                        {item.raza || `Búsqueda de ${item.categoria}`}
                      </Text>
                    </View>
                    {item.precio_max ? (
                      <View className="items-end">
                        <Text className="text-lg font-extrabold text-sky-600">
                          ${Number(item.precio_max).toLocaleString("es-AR")}
                        </Text>
                        <Text className="text-[11px] uppercase tracking-wide text-ink-muted">
                          precio máximo
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="flex-row flex-wrap gap-2">
                    <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                      <Icon name="boxes" size={14} className="text-ink-muted" />
                      <Text className="text-xs font-semibold text-ink-soft">{rangoCantidad(item)}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                      <Icon name="scale" size={14} className="text-ink-muted" />
                      <Text className="text-xs font-semibold text-ink-soft">{rangoPeso(item)}</Text>
                    </View>
                    {item.radio_km ? (
                      <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                        <Icon name="signal" size={14} className="text-ink-muted" />
                        <Text className="text-xs font-semibold text-ink-soft">
                          {item.radio_km} km
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View className="flex-row items-center gap-2 border-t border-line-soft pt-3">
                    <Avatar
                      uri={null}
                      nombre={maskNombreUsuario(item.profiles?.nombre, "Usu****", esPropia)}
                      size={30}
                    />
                    <Text className="flex-1 text-xs font-medium text-ink-soft" numberOfLines={1}>
                      {maskNombreUsuario(item.profiles?.nombre, "Usu****", esPropia)}
                    </Text>
                    <Pressable
                      onPress={() => contactarDemanda(item)}
                      disabled={ocupadoId === item.id}
                      accessibilityRole="button"
                      className="flex-row items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 active:bg-sky-100"
                    >
                      <Icon name="message" size={13} className="text-sky-600" />
                      <Text className="text-xs font-bold text-sky-700">
                        {ocupadoId === item.id
                          ? "Abriendo..."
                          : esPropia
                            ? "Ver consultas"
                            : "Consultar por chat"}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </Grid>
        )}
      </Screen>
    </View>
  );
}
