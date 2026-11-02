import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { deleteOferta, useOfertasActivas, useOfertasVendidas } from "lib/hooks/useOfferDB";
import { isSupabaseConfigured } from "lib/supabase";
import { useResponsive } from "lib/hooks/useResponsive";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Gradient, Screen } from "components/ui/Screen";
import { Logo } from "components/ui/Logo";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { OfferCard } from "features/offers/OfferCard";
import type { OfertaResumen } from "features/offers/OfferCard";

export default function FeedScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const { width } = useResponsive();

  const columns = width >= 1280 ? 3 : width >= 640 ? 2 : 1;

  const [tabEstado, setTabEstado] = useState<"activas" | "vendidas" | "todas">("activas");

  // El marketplace y galería de publicaciones es público y visible para todos los visitantes
  const {
    data: ofertasActivas,
    isLoading: loadingActivas,
    error: errorActivas,
    refetch: refetchActivas,
    isRefetching: refetchingActivas,
  } = useOfertasActivas();

  const {
    data: ofertasVendidas,
    isLoading: loadingVendidas,
    error: errorVendidas,
    refetch: refetchVendidas,
    isRefetching: refetchingVendidas,
  } = useOfertasVendidas();

  const refetch = async () => {
    await Promise.all([refetchActivas(), refetchVendidas()]);
  };
  const isRefetching = refetchingActivas || refetchingVendidas;
  const isLoading = loadingActivas || loadingVendidas;
  const error = errorActivas || errorVendidas;

  const listaActivas = ((ofertasActivas ?? []) as OfertaResumen[]).slice().sort((a, b) => {
    const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return fechaB - fechaA;
  });

  const listaVendidas = ((ofertasVendidas ?? []) as OfertaResumen[]).slice().sort((a, b) => {
    const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return fechaB - fechaA;
  });

  const listaTodas = [...listaActivas, ...listaVendidas].slice().sort((a, b) => {
    const fechaA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const fechaB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return fechaB - fechaA;
  });

  const lista =
    tabEstado === "activas"
      ? listaActivas
      : tabEstado === "vendidas"
        ? listaVendidas
        : listaTodas;

  const irAPublicar = () => {
    if (!user) {
      router.push({
        pathname: "/auth",
        params: { mode: "registro", returnUrl: "/(main)/oferta-nueva" },
      });
      return;
    }
    router.push("/(main)/oferta-nueva");
  };
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

  return (
    <View className="flex-1 bg-canvas">
      {!user ? (
        <View className="z-20 flex-row items-center justify-between border-b border-line-soft bg-surface/95 backdrop-blur-sm px-3 py-2.5 sm:px-4 sm:py-3 md:px-8">
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

          <View className="flex-row items-center gap-1.5 sm:gap-2">
            <Button
              label={width < 500 ? "Registro" : "Registrarme gratis"}
              icon={width < 400 ? undefined : "userPlus"}
              size="sm"
              onPress={() =>
                router.push({
                  pathname: "/auth",
                  params: { mode: "registro", returnUrl: "/" },
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
                  params: { mode: "login", returnUrl: "/" },
                })
              }
            />
          </View>
        </View>
      ) : (
        <MobileTopBar title="Ofertas" action onActionPress={irAPublicar} />
      )}

      <Screen
        eyebrow="Mercado Ganadero"
        title={
          tabEstado === "vendidas"
            ? "Lotes vendidos"
            : tabEstado === "activas"
              ? "Lotes disponibles"
              : "Mercado de hacienda"
        }
        subtitle={
          tabEstado === "vendidas"
            ? "Historial de publicaciones y lotes comercializados en el mercado ganadero. Referencia de precios y hacienda vendida."
            : tabEstado === "activas"
              ? "Galería de publicaciones activas en tiempo real. Conectá directo con productores y transportistas."
              : "Galería completa de lotes disponibles y comercializados en el mercado ganadero."
        }
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          user ? (
            <View className="hidden flex-row items-center gap-2 md:flex">
              <Button
                label="Publicar oferta"
                icon="plus"
                onPress={irAPublicar}
              />
            </View>
          ) : undefined
        }
      >
        {/* Selector de Sección: Disponibles / Vendidos / Todos */}
        <View className="flex-row items-center gap-2 rounded-2xl bg-surface-soft p-1.5 border border-line-soft">
          <Pressable
            onPress={() => setTabEstado("activas")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabEstado === "activas" }}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 transition-all cursor-pointer ${
              tabEstado === "activas"
                ? "bg-surface shadow-xs border border-line"
                : "opacity-70 active:opacity-100"
            }`}
          >
            <View className="h-2 w-2 rounded-full bg-emerald-500" />
            <Text
              className={`text-xs font-bold ${
                tabEstado === "activas" ? "text-ink" : "text-ink-muted"
              }`}
            >
              Disponibles ({listaActivas.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTabEstado("vendidas")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabEstado === "vendidas" }}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 transition-all cursor-pointer ${
              tabEstado === "vendidas"
                ? "bg-surface shadow-xs border border-line"
                : "opacity-70 active:opacity-100"
            }`}
          >
            <Icon
              name="badgeCheck"
              size={15}
              className={tabEstado === "vendidas" ? "text-amber-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tabEstado === "vendidas" ? "text-amber-800" : "text-ink-muted"
              }`}
            >
              Lotes vendidos ({listaVendidas.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTabEstado("todas")}
            accessibilityRole="tab"
            accessibilityState={{ selected: tabEstado === "todas" }}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 transition-all cursor-pointer ${
              tabEstado === "todas"
                ? "bg-surface shadow-xs border border-line"
                : "opacity-70 active:opacity-100"
            }`}
          >
            <Icon
              name="boxes"
              size={15}
              className={tabEstado === "todas" ? "text-sage-700" : "text-ink-muted"}
            />
            <Text
              className={`text-xs font-bold ${
                tabEstado === "todas" ? "text-ink" : "text-ink-muted"
              }`}
            >
              Todos ({listaTodas.length})
            </Text>
          </Pressable>
        </View>

        <Gradient
          colors={
            tabEstado === "vendidas"
              ? ["#FEF3C7", "#FDE68A", "#FDF8F5"]
              : ["#DCFCE7", "#E0F2FE", "#FDF8F5"]
          }
          className="flex-col gap-4 rounded-3xl border border-line-soft px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7"
        >
          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-surface/80">
                <Icon
                  name={tabEstado === "vendidas" ? "badgeCheck" : "flame"}
                  size={16}
                  className={tabEstado === "vendidas" ? "text-amber-700" : "text-clay-500"}
                />
              </View>
              <Text className="text-sm font-bold text-ink">
                {tabEstado === "vendidas" ? "Operaciones cerradas" : "Demanda en vivo"}
              </Text>
            </View>
            <Text className="text-2xl font-extrabold tracking-tight text-ink">
              {tabEstado === "vendidas"
                ? `${listaVendidas.length} ${listaVendidas.length === 1 ? "lote vendido" : "lotes vendidos"}`
                : `${lista.length} ${lista.length === 1 ? "oferta activa" : "ofertas activas"}`}
            </Text>
            <Text className="max-w-2xl text-sm text-ink-soft">
              {tabEstado === "vendidas"
                ? "Registro histórico de precios y lotes comercializados exitosamente en la plataforma."
                : "El matching automático cruza tu búsqueda con los lotes publicados por productores."}
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-2 lg:shrink-0">
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="shield" size={14} className="text-sage-600" />
              <Text className="text-xs font-semibold text-ink-soft">Productores verificados</Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="handshake" size={14} className="text-clay-500" />
              <Text className="text-xs font-semibold text-ink-soft">
                {tabEstado === "vendidas" ? "Trato directo" : "Match automático"}
              </Text>
            </View>
          </View>
        </Gradient>

        {!user ? (
          <View className="flex-row items-center gap-3 rounded-3xl border border-sage-200 bg-sage-50/90 p-4 md:px-6 md:py-4">
            <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sage-100">
              <Icon name="handshake" size={20} className="text-sage-700" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink">
                ¿Querés comprar, vender o transportar hacienda?
              </Text>
              <Text className="text-xs text-ink-muted">
                Registrate gratis para consultar por lotes, publicar hacienda y pedir cotizaciones de flete.
              </Text>
            </View>
          </View>
        ) : null}

        {!isSupabaseConfigured ? (
          <EmptyState
            icon="cloudOff"
            title="Modo demo: sin ofertas para mostrar"
            description="Configurá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env para conectar con tu proyecto de Supabase."
          />
        ) : lista.length === 0 ? (
          tabEstado === "vendidas" ? (
            <EmptyState
              icon="badgeCheck"
              title="No hay lotes vendidos para mostrar"
              description="A medida que los compradores confirmen compras en el mercado, los lotes vendidos se archivarán en esta sección como referencia histórica de precios."
            />
          ) : (
            <EmptyState
              icon="inbox"
              title="Todavía no hay ofertas activas"
              description="Sé el primero en publicar un lote y aparecé en el mercado."
              action={<Button label="Publicar oferta" icon="plus" onPress={irAPublicar} />}
            />
          )
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

