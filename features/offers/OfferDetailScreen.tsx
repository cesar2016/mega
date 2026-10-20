import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useOfertaById } from "lib/hooks/useOfferDB";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Badge, Card, SectionHeader } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { fotosDe, mediaOrdenado, portadaDe, videosDe } from "components/ui/OfertaMedia";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";

type Oferta = {
  id: string;
  categoria: string;
  raza?: string | null;
  cantidad: number;
  peso_promedio?: number | null;
  edad?: string | null;
  precio: number;
  tipo_precio?: string | null;
  descripcion?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  estado?: string | null;
  created_at?: string | null;
  profiles?: { nombre?: string | null; avatar_url?: string | null; rol?: string | null } | null;
  oferta_media?: OfertaMediaRow[] | null;
};

const TIPO_PRECIO_LABEL: Record<string, string> = {
  por_kilo: "por kilo",
  por_cabeza: "por cabeza",
  a_convenir: "a convenir",
};

function formatPrecio(oferta: Oferta) {
  if (oferta.tipo_precio === "por_kilo") {
    return `$${Number(oferta.precio).toLocaleString("es-AR")} / kg`;
  }
  if (oferta.tipo_precio === "por_cabeza") {
    return `$${Number(oferta.precio).toLocaleString("es-AR")} / cabeza`;
  }
  return `$${Number(oferta.precio).toLocaleString("es-AR")}`;
}

/** Reproductor de video (web y nativo con expo-video). */
function VideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = true;
  });

  return (
    <View className="h-full w-full">
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        nativeControls
        contentFit="contain"
        allowsFullscreen
        allowsPictureInPicture
      />
    </View>
  );
}

function Dato({ icon, label, value }: { icon: "boxes" | "scale" | "calendar" | "mapPin"; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-soft px-3.5 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface">
        <Icon name={icon} size={16} className="text-ink-soft" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </Text>
        <Text className="text-sm font-semibold text-ink">{value}</Text>
      </View>
    </View>
  );
}

/** Detalle de una publicación: fotos, video y todos los datos del lote. */
export default function OfferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activoId, setActivoId] = useState<string | null>(null);

  const { data, isLoading, error } = useOfertaById(String(id ?? ""));

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando la publicación...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-canvas">
        <MobileTopBar title="Publicación" onBack={() => router.back()} />
        <Screen>
          <EmptyState
            icon="alert"
            title="No encontramos la publicación"
            description={error ? String((error as Error).message ?? error) : "Puede que haya sido retirada."}
            action={<Button label="Volver al mercado" icon="arrowLeft" onPress={() => router.replace("/(main)/tabs/feed")} />}
          />
        </Screen>
      </View>
    );
  }

  const oferta = data as Oferta;
  const todos = mediaOrdenado(oferta.oferta_media);
  const fotos = fotosDe(oferta.oferta_media);
  const videos = videosDe(oferta.oferta_media);
  const portada = portadaDe(oferta.oferta_media);
  const activo = todos.find((item) => item.id === activoId) ?? portada ?? todos[0] ?? null;

  const irAlChat = () => showToast("La mensajería entre partes llega en la próxima versión", "info");

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Publicación" onBack={() => router.back()} />

      <Screen
        eyebrow={oferta.categoria}
        title={oferta.raza || `Lote de ${oferta.categoria}`}
        subtitle={
          oferta.provincia
            ? [oferta.localidad, oferta.provincia].filter(Boolean).join(", ")
            : undefined
        }
        action={
          <Button
            label="Volver"
            icon="arrowLeft"
            variant="secondary"
            onPress={() => router.back()}
            className="hidden md:flex"
          />
        }
      >
        <View className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Media */}
          <View className="gap-4">
            <View className="h-60 w-full overflow-hidden rounded-3xl border border-line-soft bg-surface-sunk md:h-80">
              {activo ? (
                activo.tipo === "video" && activo.url ? (
                  <VideoPlayer url={activo.url} />
                ) : (
                  <MediaImagen url={activo.url} className="h-full w-full" />
                )
              ) : (
                <Gradient
                  colors={["#E4EDE5", "#F8E6DA"]}
                  className="h-full w-full items-center justify-center gap-2"
                >
                  <Icon name="beef" size={40} className="text-sage-400" />
                  <Text className="text-sm font-semibold text-sage-600">
                    El productor todavía no subió fotos
                  </Text>
                </Gradient>
              )}
            </View>

            {todos.length > 0 ? (
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Galería · {fotos.length} foto{fotos.length === 1 ? "" : "s"}
                  {videos.length > 0
                    ? ` · ${videos.length} video${videos.length === 1 ? "" : "s"}`
                    : ""}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 10, paddingRight: 8 }}
                >
                  {todos.map((item) => {
                    const seleccionado = activo?.id === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setActivoId(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          item.tipo === "video" ? "Ver video" : "Ver foto"
                        }
                        className={[
                          "h-20 w-24 overflow-hidden rounded-2xl border-2",
                          seleccionado ? "border-sage-500" : "border-line-soft",
                        ].join(" ")}
                      >
                        <MediaImagen url={item.url} className="h-full w-full" />
                        {item.tipo === "video" ? (
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="h-8 w-8 items-center justify-center rounded-full bg-ink/60">
                              <Icon name="video" size={14} className="text-white" />
                            </View>
                          </View>
                        ) : null}
                        {item.es_portada ? (
                          <View className="absolute left-1 top-1 rounded-md bg-sage-600 px-1.5 py-0.5">
                            <Text className="text-[9px] font-bold text-white">Portada</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {oferta.descripcion ? (
              <Card className="gap-2">
                <SectionHeader title="Descripción" />
                <Text className="text-sm leading-6 text-ink-soft">{oferta.descripcion}</Text>
              </Card>
            ) : null}
          </View>

          {/* Detalle + contacto */}
          <View className="gap-4 lg:sticky lg:top-6 lg:self-start">
            <Gradient
              colors={["#E4EDE5", "#F8E6DA"]}
              className="gap-3 rounded-3xl border border-line-soft p-5"
            >
              <View className="flex-row flex-wrap items-center gap-2">
                <Badge tone="sage" icon="beef">
                  {oferta.categoria?.toUpperCase() ?? "LOTE"}
                </Badge>
                {oferta.edad ? <Badge tone="wheat" icon="calendar">{oferta.edad}</Badge> : null}
                {oferta.estado ? (
                  <Badge tone={oferta.estado === "activa" ? "sky" : "neutral"}>
                    {oferta.estado}
                  </Badge>
                ) : null}
              </View>

              <View className="gap-1">
                <Text className="text-3xl font-extrabold tracking-tight text-ink">
                  {formatPrecio(oferta)}
                </Text>
                {oferta.tipo_precio && oferta.tipo_precio !== "a_convenir" ? (
                  <Text className="text-xs uppercase tracking-wide text-ink-muted">
                    {TIPO_PRECIO_LABEL[oferta.tipo_precio]}
                  </Text>
                ) : null}
              </View>

              <View className="flex-row flex-wrap gap-2">
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface/80 px-2.5 py-1.5">
                  <Icon name="boxes" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    {oferta.cantidad} cab.
                  </Text>
                </View>
                {oferta.peso_promedio ? (
                  <View className="flex-row items-center gap-1.5 rounded-xl bg-surface/80 px-2.5 py-1.5">
                    <Icon name="scale" size={14} className="text-ink-muted" />
                    <Text className="text-xs font-semibold text-ink-soft">
                      {oferta.peso_promedio} kg prom.
                    </Text>
                  </View>
                ) : null}
              </View>
            </Gradient>

            <Card className="gap-3">
              <SectionHeader title="Datos del lote" />
              <View className="gap-2">
                <Dato icon="boxes" label="Cantidad" value={`${oferta.cantidad} cabezas`} />
                <Dato
                  icon="scale"
                  label="Peso promedio"
                  value={oferta.peso_promedio ? `${oferta.peso_promedio} kg` : "Sin informar"}
                />
                <Dato
                  icon="calendar"
                  label="Edad"
                  value={oferta.edad || "Sin informar"}
                />
                <Dato
                  icon="mapPin"
                  label="Ubicación"
                  value={
                    [oferta.localidad, oferta.provincia].filter(Boolean).join(", ") ||
                    "Sin informar"
                  }
                />
              </View>
            </Card>

            <Card className="gap-3">
              <View className="flex-row items-center gap-3">
                <Avatar
                  uri={oferta.profiles?.avatar_url}
                  nombre={oferta.profiles?.nombre}
                  size={44}
                />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-ink">
                    {oferta.profiles?.nombre || "Productor"}
                  </Text>
                  <Text className="text-xs text-ink-muted">Productor del lote</Text>
                </View>
                <Icon name="badgeCheck" size={18} className="text-sage-500" />
              </View>

              <View className="flex-row gap-2">
                <Button
                  label="Contactar"
                  icon="message"
                  onPress={irAlChat}
                  className="flex-1"
                />
                <Button
                  label="Pedir flete"
                  icon="truck"
                  variant="secondary"
                  onPress={() =>
                    showToast("La solicitud de flete llega en la próxima versión", "info")
                  }
                  className="flex-1"
                />
              </View>
            </Card>
          </View>
        </View>
      </Screen>
    </View>
  );
}

/** Imagen de la media (foto o póster del video). */
function MediaImagen({ url, className = "" }: { url?: string | null; className?: string }) {
  if (!url) return <View className={`h-full w-full bg-surface-sunk ${className}`} />;
  return (
    <View className={`overflow-hidden bg-surface-sunk ${className}`}>
      <Image source={{ uri: url }} className="h-full w-full" />
    </View>
  );
}
