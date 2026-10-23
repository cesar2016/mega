import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { iniciarOAbrirConversacion } from "lib/hooks/useChat";
import { actualizarEstadoMatch, useMatches } from "lib/hooks/useMatches";
import type { EstadoMatch, MatchRow } from "lib/hooks/useMatches";
import { useResponsive } from "lib/hooks/useResponsive";
import { isSupabaseConfigured } from "lib/supabase";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { EmptyState } from "components/ui/Avatar";
import { Button } from "components/ui/Button";
import { Grid } from "components/ui/Grid";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { MatchCard } from "features/matches/MatchCard";

type Filtro = "pendiente" | "aceptado" | "rechazado" | "todos";

const FILTROS: { clave: Filtro; label: string }[] = [
  { clave: "pendiente", label: "Pendientes" },
  { clave: "aceptado", label: "Aceptados" },
  { clave: "rechazado", label: "Descartados" },
  { clave: "todos", label: "Todos" },
];

function FiltroChip({
  label,
  activo,
  onPress,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      className={[
        "rounded-full border px-3.5 py-2",
        activo ? "border-sage-500 bg-sage-500" : "border-line bg-surface active:bg-surface-sunk",
      ].join(" ")}
    >
      <Text
        className={[
          "text-xs font-semibold",
          activo ? "text-white" : "text-ink-soft",
        ].join(" ")}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Cruces del matching automático: los lotes que coinciden con las demandas del
 * usuario y las demandas que coinciden con sus lotes.
 */
export default function MatchesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const { width } = useResponsive();
  const columns = width >= 1280 ? 3 : width >= 768 ? 2 : 1;

  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { data, isLoading, error, refetch, isRefetching } = useMatches({
    enabled: !!profile,
  });

  const matches = useMemo(() => (data ?? []) as MatchRow[], [data]);

  const visibles = useMemo(
    () => (filtro === "todos" ? matches : matches.filter((m) => m.estado === filtro)),
    [filtro, matches],
  );

  const pendientes = matches.filter((m) => m.estado === "pendiente").length;
  const mejorPuntaje = matches.length > 0 ? Math.max(...matches.map((m) => m.puntaje)) : 0;

  const cambiarEstado = async (id: string, estado: EstadoMatch) => {
    setOcupado(id);
    try {
      await actualizarEstadoMatch(id, estado);
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      showToast(
        estado === "aceptado"
          ? "Match aceptado. Ahora podés coordinar con la contraparte."
          : "Match descartado",
        estado === "aceptado" ? "success" : "info",
      );
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "No se pudo actualizar el match",
        "error",
      );
    } finally {
      setOcupado(null);
    }
  };

  const contraparteDe = (match: MatchRow): "oferta" | "demanda" =>
    match.ofertas?.productor_id === profile?.id ? "demanda" : "oferta";

  const contactarMatch = async (match: MatchRow) => {
    if (!isSupabaseConfigured) {
      router.push("/(main)/tabs/chat");
      return;
    }

    const tipoContraparte = contraparteDe(match);
    const contraparteId =
      tipoContraparte === "demanda"
        ? (match.demandas?.comprador_id ?? match.demandas?.profiles?.id)
        : (match.ofertas?.productor_id ?? match.ofertas?.profiles?.id);

    if (!contraparteId) {
      showToast("No se pudo identificar a la contraparte", "error");
      return;
    }

    setOcupado(match.id);
    try {
      const convId = await iniciarOAbrirConversacion({
        contraparteId,
        ofertaId: match.oferta_id,
        demandaId: match.demanda_id,
      });
      await queryClient.invalidateQueries({ queryKey: ["conversaciones"] });
      router.push({ pathname: "/(main)/tabs/chat", params: { id: convId } });
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "No se pudo abrir el chat",
        "error",
      );
    } finally {
      setOcupado(null);
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
        <Text className="text-sm text-ink-muted">Buscando cruces con el mercado...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Matches" />

      <Screen
        eyebrow="Matching automático"
        title="Tus cruces"
        subtitle="El sistema cruza tus lotes con las demandas activas del mercado y te propone los mejores primero."
        onRefresh={() => refetch()}
        refreshing={isRefetching}
      >
        <Gradient
          colors={["#E4EDE5", "#E1EAF0", "#F4F2EC"]}
          className="flex-col gap-4 rounded-3xl border border-line-soft px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7"
        >
          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-xl bg-surface/80">
                <Icon name="sparkles" size={16} className="text-sage-600" />
              </View>
              <Text className="text-sm font-bold text-ink">Resumen</Text>
            </View>
            <Text className="text-2xl font-extrabold tracking-tight text-ink">
              {pendientes} {pendientes === 1 ? "cruce pendiente" : "cruces pendientes"}
            </Text>
            <Text className="max-w-2xl text-sm text-ink-soft">
              {mejorPuntaje > 0
                ? `Tu mejor cruce tiene ${mejorPuntaje}% de compatibilidad.`
                : "Todavía no hay cruces: publicá un lote o una demanda para empezar a cruzar con el mercado."}
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center gap-2 lg:shrink-0">
            <View className="flex-row items-center gap-1.5 rounded-2xl bg-surface/80 px-3 py-2">
              <Icon name="signal" size={14} className="text-sage-600" />
              <Text className="text-xs font-semibold text-ink-soft">Categoría, raza, peso, precio y distancia</Text>
            </View>
          </View>
        </Gradient>

        <View className="flex-row flex-wrap gap-2">
          {FILTROS.map((item) => (
            <FiltroChip
              key={item.clave}
              label={item.label}
              activo={filtro === item.clave}
              onPress={() => setFiltro(item.clave)}
            />
          ))}
        </View>

        {error ? (
          <EmptyState
            icon="cloudOff"
            title="No pudimos cargar los cruces"
            description={String((error as Error)?.message ?? error)}
            action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
          />
        ) : !isSupabaseConfigured ? (
          <EmptyState
            icon="cloudOff"
            title="Modo demo: sin cruces para mostrar"
            description="Configurá las variables EXPO_PUBLIC_SUPABASE_* en .env para conectar con tu proyecto de Supabase."
          />
        ) : matches.length === 0 ? (
          <EmptyState
            icon="sparkles"
            title="Todavía no tenés cruces"
            description="Cuando publiques un lote o una demanda que coincida con el otro lado del mercado, el cruce aparece acá con su puntaje."
            action={
              <Button
                label="Publicar oferta"
                icon="plus"
                onPress={() => router.push("/(main)/oferta-nueva")}
              />
            }
          />
        ) : visibles.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No hay cruces en este filtro"
            description="Probá con otro filtro para ver el resto de los cruces del mercado."
          />
        ) : (
          <Grid columns={columns}>
            {visibles.map((match) => {
              const contraparte = contraparteDe(match);

              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  contraparte={contraparte}
                  busy={ocupado === match.id}
                  onAceptar={() => cambiarEstado(match.id, "aceptado")}
                  onRechazar={() => cambiarEstado(match.id, "rechazado")}
                  onVerOferta={() => router.push(`/(main)/oferta/${match.oferta_id}`)}
                  onContactar={() => contactarMatch(match)}
                />
              );
            })}
          </Grid>
        )}
      </Screen>
    </View>
  );
}
