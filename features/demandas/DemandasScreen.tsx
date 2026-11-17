import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { cancelarDemanda, useDemandasActivas } from "lib/hooks/useDemandaDB";
import { useMatches } from "lib/hooks/useMatches";
import type { MatchRow } from "lib/hooks/useMatches";
import { useResponsive } from "lib/hooks/useResponsive";
import { isSupabaseConfigured } from "lib/supabase";
import { useAuthStore } from "store/authStore";
import { useAuthRedirect } from "lib/hooks/useAuthRedirect";
import { maskNombreUsuario, showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { DemandaCreateModal } from "./DemandaCreateModal";

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
  estado?: string | null;
  created_at?: string | null;
  profiles?: { id?: string | null; nombre?: string | null; avatar_url?: string | null } | null;
};

const CATEGORIAS_FILTRO = [
  "Todas",
  "Novillos",
  "Vaquillonas",
  "Terneros",
  "Vacas",
  "Toros",
];

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

function formatoPrecio(demanda: Demanda) {
  if (demanda.tipo_precio === "a_convenir") return "A convenir";
  if (!demanda.precio_max) return "Precio a convenir";
  const num = Number(demanda.precio_max).toLocaleString("es-AR");
  const unidad = demanda.tipo_precio === "por_cabeza" ? "/ cab." : "/ kg";
  return `$${num} ${unidad}`;
}

/**
 * Demandas de compra (comprador).
 * Muestra las búsquedas activas y permite al usuario definir exactamente qué hacienda
 * está buscando (categoría, peso min-max, precio tope y radio km a la redonda) para
 * generar matches automáticos instantáneos con los lotes en venta.
 */
export default function DemandasScreen() {
  const redirect = useAuthRedirect({ returnUrl: "/(main)/tabs/demandas" });
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);
  const { width } = useResponsive();
  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;

  // Estado del modal de creación
  const [modalCrearVisible, setModalCrearVisible] = useState(false);

  // Filtros
  const [pestana, setPestana] = useState<"todas" | "mias">("todas");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useDemandasActivas({
    enabled: !!profile,
  });

  const { data: matchesData } = useMatches({
    enabled: !!profile,
  });

  // Mapear cuántos matches tiene cada demanda del usuario
  const matchesPorDemanda = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of (matchesData ?? []) as MatchRow[]) {
      if (m.demanda_id) {
        map[m.demanda_id] = (map[m.demanda_id] ?? 0) + 1;
      }
    }
    return map;
  }, [matchesData]);

  const listaCompleta = useMemo(() => (data ?? []) as Demanda[], [data]);

  // Demandas del usuario actual
  const misDemandas = useMemo(() => {
    if (!user?.id) return [];
    return listaCompleta.filter(
      (item) => item.comprador_id === user.id || item.profiles?.id === user.id
    );
  }, [listaCompleta, user?.id]);

  // Filtrado final según pestaña y categoría
  const listaFiltrada = useMemo(() => {
    let base = pestana === "mias" ? misDemandas : listaCompleta;
    if (categoriaFiltro !== "Todas") {
      base = base.filter(
        (item) => item.categoria.toLowerCase() === categoriaFiltro.toLowerCase()
      );
    }
    return base;
  }, [pestana, misDemandas, listaCompleta, categoriaFiltro]);

  if (redirect) return redirect;

  const contactarDemanda = (item: Demanda) => {
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

    router.push({
      pathname: "/(main)/tabs/chat",
      params: { demandaId: item.id },
    });
  };

  const handleCancelarDemanda = async (item: Demanda) => {
    const confirmar = async () => {
      setProcesandoId(item.id);
      try {
        await cancelarDemanda(item.id);
        showToast("Búsqueda cancelada con éxito", "info");
        refetch();
        queryClient.invalidateQueries({ queryKey: ["demandas_activas"] });
        queryClient.invalidateQueries({ queryKey: ["demandas_comprador"] });
        queryClient.invalidateQueries({ queryKey: ["matches"] });
      } catch (err: any) {
        showToast(err?.message || "No se pudo cancelar la búsqueda", "error");
      } finally {
        setProcesandoId(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("¿Seguro que deseás pausar esta búsqueda? Dejará de recibir nuevos matches.")) {
        confirmar();
      }
    } else {
      Alert.alert(
        "Pausar búsqueda",
        "¿Seguro que deseás pausar esta búsqueda? Dejará de recibir nuevos matches.",
        [
          { text: "No, mantener activa", style: "cancel" },
          { text: "Sí, pausar", style: "destructive", onPress: confirmar },
        ]
      );
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

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar
        title="Demandas"
        action
        onActionPress={() => setModalCrearVisible(true)}
        actionIcon="plus"
      />

      <Screen
        eyebrow="Búsquedas de hacienda"
        title="Demandas activas"
        subtitle="Indicá qué hacienda estás buscando comprar. El sistema buscará matches automáticos según categoría, peso, precio y radio de cobertura."
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          <Button
            label="Indicar qué buscás"
            icon="sparkles"
            onPress={() => setModalCrearVisible(true)}
            className="hidden md:flex"
          />
        }
      >
        {/* Banner principal explicativo y de llamada a la acción */}
        <Gradient
          colors={["#E1EAF0", "#F8E6DA", "#F4F2EC"]}
          className="flex-col gap-4 rounded-3xl border border-line-soft px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7"
        >
          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-surface/80">
                <Icon name="sparkles" size={16} className="text-sky-500" />
              </View>
              <Text className="text-sm font-bold text-ink">Búsquedas activas del mercado</Text>
            </View>
            <Text className="text-2xl font-extrabold tracking-tight text-ink">
              {listaCompleta.length} {listaCompleta.length === 1 ? "demanda abierta" : "demandas abiertas"}
            </Text>
            <Text className="max-w-2xl text-sm text-ink-soft">
              Publicá tus preferencias de compra (categoría, peso mínimo/máximo, precio tope y radio de búsqueda) para recibir alertas ni bien haya lotes compatibles.
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-2.5 lg:shrink-0">
            <Button
              label="Indicar qué buscás"
              icon="sparkles"
              onPress={() => setModalCrearVisible(true)}
              className="w-full sm:w-auto"
            />
          </View>
        </Gradient>

        {/* Pestañas: Todas vs Mis búsquedas */}
        <View className="flex-row items-center justify-between border-b border-line-soft pb-3 pt-2">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setPestana("todas")}
              className={[
                "flex-row items-center gap-1.5 rounded-full px-4 py-2 border",
                pestana === "todas"
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface active:bg-surface-sunk",
              ].join(" ")}
            >
              <Text
                className={[
                  "text-xs font-bold",
                  pestana === "todas" ? "text-white" : "text-ink-soft",
                ].join(" ")}
              >
                Todas las demandas ({listaCompleta.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPestana("mias")}
              className={[
                "flex-row items-center gap-1.5 rounded-full px-4 py-2 border",
                pestana === "mias"
                  ? "border-sage-600 bg-sage-500 text-white"
                  : "border-line bg-surface active:bg-surface-sunk",
              ].join(" ")}
            >
              <Icon
                name="user"
                size={13}
                className={pestana === "mias" ? "text-white" : "text-ink-soft"}
              />
              <Text
                className={[
                  "text-xs font-bold",
                  pestana === "mias" ? "text-white" : "text-ink-soft",
                ].join(" ")}
              >
                Mis búsquedas ({misDemandas.length})
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Filtros rápidos por categoría */}
        <View className="flex-row flex-wrap items-center gap-1.5">
          {CATEGORIAS_FILTRO.map((cat) => {
            const sel = categoriaFiltro === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategoriaFiltro(cat)}
                className={[
                  "rounded-full border px-3 py-1.5",
                  sel
                    ? "border-sky-500 bg-sky-500 text-white font-bold"
                    : "border-line bg-surface active:bg-surface-sunk",
                ].join(" ")}
              >
                <Text
                  className={[
                    "text-xs font-semibold",
                    sel ? "text-white font-bold" : "text-ink-soft",
                  ].join(" ")}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Estados de error, demo o vacío */}
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
        ) : listaFiltrada.length === 0 ? (
          <EmptyState
            icon="search"
            title={
              pestana === "mias"
                ? "Todavía no publicaste ninguna búsqueda"
                : "No hay demandas que coincidan con los filtros"
            }
            description={
              pestana === "mias"
                ? "Indicá qué hacienda buscás (ej: Novillos 260-450 kg a 500 km) y el sistema buscará lotes automáticamente."
                : "Probá cambiando la categoría o publicá una nueva búsqueda de compra."
            }
            action={
              <Button
                label="Indicar qué buscás ahora"
                icon="sparkles"
                onPress={() => setModalCrearVisible(true)}
              />
            }
          />
        ) : (
          <Grid columns={columns}>
            {listaFiltrada.map((item) => {
              const esPropia = Boolean(
                user?.id && (item.comprador_id === user.id || item.profiles?.id === user.id)
              );
              const cantMatches = matchesPorDemanda[item.id] ?? 0;
              const estaProcesando = procesandoId === item.id;

              return (
                <Card key={item.id} className="gap-3.5">
                  {/* Encabezado de la tarjeta */}
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1 gap-1.5">
                      <View className="flex-row items-center gap-1.5 flex-wrap">
                        <Badge tone={esPropia ? "sage" : "sky"} icon={esPropia ? "user" : "shoppingCart"}>
                          {esPropia ? "TU BÚSQUEDA" : item.categoria?.toUpperCase() ?? "DEMANDA"}
                        </Badge>
                        {item.raza ? (
                          <Badge tone="neutral">{item.raza}</Badge>
                        ) : null}
                      </View>
                      <Text className="text-base font-bold text-ink" numberOfLines={1}>
                        Búsqueda de {item.categoria}
                      </Text>
                    </View>

                    {item.precio_max ? (
                      <View className="items-end">
                        <Text className="text-lg font-extrabold text-sky-600">
                          {formatoPrecio(item)}
                        </Text>
                        <Text className="text-[10px] uppercase tracking-wide text-ink-muted">
                          precio tope
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Atributos: Peso, Cantidad, Radio, Ubicación */}
                  <View className="flex-row flex-wrap gap-2">
                    {/* Peso */}
                    <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                      <Icon name="scale" size={14} className="text-ink-muted" />
                      <Text className="text-xs font-semibold text-ink-soft">
                        {rangoPeso(item)}
                      </Text>
                    </View>

                    {/* Radio */}
                    {item.radio_km ? (
                      <View className="flex-row items-center gap-1.5 rounded-xl bg-clay-50 px-2.5 py-1.5 border border-clay-100">
                        <Icon name="signal" size={14} className="text-clay-600" />
                        <Text className="text-xs font-semibold text-clay-700">
                          Hasta {item.radio_km} km
                        </Text>
                      </View>
                    ) : null}

                    {/* Ubicación */}
                    {item.provincia ? (
                      <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                        <Icon name="mapPin" size={14} className="text-ink-muted" />
                        <Text className="text-xs font-semibold text-ink-soft">
                          {[item.localidad, item.provincia].filter(Boolean).join(", ")}
                        </Text>
                      </View>
                    ) : null}

                    {/* Cantidad de cabezas */}
                    {item.cantidad_min || item.cantidad_max ? (
                      <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                        <Icon name="boxes" size={14} className="text-ink-muted" />
                        <Text className="text-xs font-semibold text-ink-soft">
                          {rangoCantidad(item)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Sección de Matches generados para la demanda propia */}
                  {esPropia ? (
                    <View className="flex-row items-center justify-between rounded-2xl bg-sage-50/80 border border-sage-200 p-3">
                      <View className="flex-row items-center gap-2">
                        <View className="h-7 w-7 items-center justify-center rounded-lg bg-sage-500">
                          <Icon name="sparkles" size={14} className="text-white" />
                        </View>
                        <View>
                          <Text className="text-xs font-bold text-sage-900">
                            {cantMatches > 0
                              ? `${cantMatches} ${cantMatches === 1 ? "match encontrado" : "matches encontrados"}`
                              : "Esperando lotes compatibles"}
                          </Text>
                          <Text className="text-[11px] text-sage-700">
                            {cantMatches > 0 ? "Revisá las ofertas compatibles" : "El sistema busca en tiempo real"}
                          </Text>
                        </View>
                      </View>

                      {cantMatches > 0 ? (
                        <Pressable
                          onPress={() => router.push("/(main)/tabs/matches")}
                          className="rounded-xl bg-sage-600 px-3 py-1.5 active:bg-sage-700"
                        >
                          <Text className="text-xs font-bold text-white">Ver matches</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Barra inferior: usuario + acción */}
                  <View className="flex-row items-center justify-between gap-2 border-t border-line-soft pt-3">
                    <View className="flex-row items-center gap-2 min-w-0 flex-1">
                      <Avatar
                        uri={null}
                        nombre={maskNombreUsuario(item.profiles?.nombre, "Usu****", esPropia)}
                        size={28}
                      />
                      <Text className="text-xs font-medium text-ink-soft" numberOfLines={1}>
                        {esPropia ? "Vos (comprador)" : maskNombreUsuario(item.profiles?.nombre, "Usu****", esPropia)}
                      </Text>
                    </View>

                    {esPropia ? (
                      <Pressable
                        onPress={() => handleCancelarDemanda(item)}
                        disabled={estaProcesando}
                        accessibilityRole="button"
                        className="flex-row items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 active:bg-surface-sunk"
                      >
                        {estaProcesando ? (
                          <ActivityIndicator size="small" className="text-clay-500" />
                        ) : (
                          <>
                            <Icon name="trash" size={12} className="text-clay-600" />
                            <Text className="text-xs font-medium text-clay-700">Pausar</Text>
                          </>
                        )}
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => contactarDemanda(item)}
                        accessibilityRole="button"
                        className="flex-row items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 active:bg-sky-100"
                      >
                        <Icon name="message" size={13} className="text-sky-600" />
                        <Text className="text-xs font-bold text-sky-700">
                          Consultar por chat
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </Card>
              );
            })}
          </Grid>
        )}
      </Screen>

      {/* Modal interactivo de creación de demanda */}
      <DemandaCreateModal
        visible={modalCrearVisible}
        onClose={() => setModalCrearVisible(false)}
        onSuccess={(_count) => {
          refetch();
        }}
      />
    </View>
  );
}
