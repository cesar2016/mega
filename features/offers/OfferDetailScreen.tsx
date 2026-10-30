import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useVideoPlayer, VideoView } from "expo-video";
import { deleteOferta, useOfertaById } from "lib/hooks/useOfferDB";
import { isSupabaseConfigured } from "lib/supabase";
import { maskNombreUsuario, showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Badge, Card, SectionHeader } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { ShareOfferModal } from "./ShareOfferModal";
import { AuthPromptModal } from "features/auth/AuthPromptModal";
import {
  fotosDe,
  mediaOrdenado,
  parseVideoTrimUrl,
  portadaDe,
  videosDe,
} from "components/ui/OfertaMedia";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";

type Oferta = {
  id: string;
  productor_id?: string | null;
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
  profiles?: { id?: string | null; nombre?: string | null; avatar_url?: string | null; rol?: string | null } | null;
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

/** Reproductor de video (web y nativo, respetando el rango de recorte `#t=inicio,fin`). */
function VideoPlayer({ url }: { url: string }) {
  const { cleanUrl, inicio, fin } = parseVideoTrimUrl(url);

  if (Platform.OS === "web") {
    return (
      <View className="h-full w-full bg-ink">
        <video
          src={url}
          controls
          playsInline
          onLoadedMetadata={(e) => {
            if (inicio !== undefined && inicio > 0) {
              e.currentTarget.currentTime = inicio;
            }
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (fin !== undefined && el.currentTime >= fin) {
              el.pause();
              el.currentTime = inicio ?? 0;
            } else if (inicio !== undefined && el.currentTime < inicio - 0.25) {
              el.currentTime = inicio;
            }
          }}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </View>
    );
  }

  return <NativeVideoPlayer url={cleanUrl || url} inicio={inicio} fin={fin} />;
}

function NativeVideoPlayer({
  url,
  inicio,
  fin,
}: {
  url: string;
  inicio?: number;
  fin?: number;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = true;
    if (inicio !== undefined && inicio > 0) {
      p.currentTime = inicio;
    }
  });

  useEffect(() => {
    if (inicio === undefined && fin === undefined) return;
    const timer = setInterval(() => {
      const current = player.currentTime ?? 0;
      if (fin !== undefined && current >= fin) {
        player.pause();
        player.currentTime = inicio ?? 0;
      }
    }, 250);
    return () => clearInterval(timer);
  }, [player, inicio, fin]);

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
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [activoId, setActivoId] = useState<string | null>(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalMotivo, setAuthModalMotivo] = useState<"chat" | "flete">("chat");

  const onVolver = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(user ? "/(main)/tabs/feed" : "/auth");
    }
  };

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
        <MobileTopBar title="Publicación" onBack={onVolver} />
        <Screen>
          <EmptyState
            icon="alert"
            title="No encontramos la publicación"
            description={error ? String((error as Error).message ?? error) : "Puede que haya sido retirada."}
            action={<Button label="Volver al mercado" icon="arrowLeft" onPress={onVolver} />}
          />
        </Screen>
      </View>
    );
  }

  const oferta = data as Oferta;
  const esPropia = Boolean(user?.id && oferta.productor_id === user.id);
  const todos = mediaOrdenado(oferta.oferta_media);
  const fotos = fotosDe(oferta.oferta_media);
  const videos = videosDe(oferta.oferta_media);
  const portada = portadaDe(oferta.oferta_media);
  const activo = todos.find((item) => item.id === activoId) ?? portada ?? todos[0] ?? null;

  const irAlChat = () => {
    if (!user) {
      setAuthModalMotivo("chat");
      setAuthModalVisible(true);
      return;
    }

    if (esPropia || !isSupabaseConfigured) {
      router.push("/(main)/tabs/chat");
      return;
    }

    const contraparteId = oferta.productor_id ?? oferta.profiles?.id;
    if (!contraparteId) {
      showToast("No se pudo identificar al vendedor del lote", "error");
      return;
    }

    router.push({
      pathname: "/(main)/tabs/chat",
      params: { ofertaId: oferta.id },
    });
  };

  const pedirFlete = () => {
    if (!user) {
      setAuthModalMotivo("flete");
      setAuthModalVisible(true);
      return;
    }
    showToast("La solicitud de flete llega en la próxima versión", "info");
  };

  const irAEditar = () =>
    router.push({ pathname: "/(main)/oferta-nueva", params: { id: oferta.id } });

  const onEliminar = async () => {
    try {
      setEliminando(true);
      const urls = (oferta.oferta_media ?? []).map((m) => m.url);
      await deleteOferta(oferta.id, urls);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ofertas_activas"] }),
        queryClient.invalidateQueries({ queryKey: ["ofertas_productor"] }),
        queryClient.invalidateQueries({ queryKey: ["matches"] }),
        queryClient.invalidateQueries({ queryKey: ["oferta", oferta.id] }),
      ]);
      showToast("Publicación eliminada correctamente", "success");
      router.replace("/(main)/tabs/ofertas");
    } catch (err: any) {
      console.error("Error al eliminar oferta:", err);
      showToast(err?.message || "No se pudo eliminar la publicación", "error");
    } finally {
      setEliminando(false);
      setConfirmandoEliminar(false);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar
        title="Publicación"
        onBack={onVolver}
        action
        actionIcon="share"
        onActionPress={() => setShareModalVisible(true)}
      />

      <Screen
        eyebrow={oferta.categoria}
        title={oferta.raza || `Lote de ${oferta.categoria}`}
        subtitle={
          oferta.provincia
            ? [oferta.localidad, oferta.provincia].filter(Boolean).join(", ")
            : undefined
        }
        action={
          <View className="hidden flex-row items-center gap-2 md:flex">
            <Button
              label="Compartir"
              icon="share"
              variant="soft"
              onPress={() => setShareModalVisible(true)}
            />
            {esPropia ? (
              <Button
                label="Editar"
                icon="pencil"
                variant="soft"
                onPress={irAEditar}
              />
            ) : null}
            <Button
              label="Volver"
              icon="arrowLeft"
              variant="secondary"
              onPress={onVolver}
            />
          </View>
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
                        <MediaImagen
                          url={item.url}
                          tipo={item.tipo}
                          className="h-full w-full"
                        />
                        {item.tipo === "video" ? (
                          <View className="absolute inset-0 items-center justify-center bg-ink/20">
                            <View className="h-8 w-8 items-center justify-center rounded-full bg-ink/65">
                              <Icon name="video" size={14} className="text-white" />
                            </View>
                            {item.duracion_segundos ? (
                              <View className="absolute bottom-1 right-1 rounded-md bg-ink/75 px-1 py-0.5">
                                <Text className="text-[9px] font-semibold text-white">
                                  {item.duracion_segundos}s
                                </Text>
                              </View>
                            ) : null}
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

            {esPropia ? (
              <Card className="gap-3 border-sage-200 bg-sage-50/40">
                <View className="flex-row items-center gap-2">
                  <Icon name="sliders" size={16} className="text-sage-600" />
                  <Text className="text-sm font-bold text-ink">Gestionar tu publicación</Text>
                </View>
                <Text className="text-xs leading-4 text-ink-muted">
                  Podés actualizar los datos, cambiar o agregar fotos y videos, o eliminar el lote.
                </Text>

                {confirmandoEliminar ? (
                  <View className="gap-2 rounded-2xl border border-clay-200 bg-surface p-3">
                    <Text className="text-xs font-semibold text-clay-700">
                      ¿Confirmás eliminar esta publicación? Esta acción no se puede deshacer.
                    </Text>
                    <View className="flex-row gap-2">
                      <Button
                        label="Sí, eliminar"
                        icon="trash"
                        variant="danger"
                        size="sm"
                        loading={eliminando}
                        onPress={onEliminar}
                        className="flex-1"
                      />
                      <Button
                        label="Cancelar"
                        variant="secondary"
                        size="sm"
                        disabled={eliminando}
                        onPress={() => setConfirmandoEliminar(false)}
                        className="flex-1"
                      />
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-2">
                    <Button
                      label="Editar"
                      icon="pencil"
                      variant="primary"
                      onPress={irAEditar}
                      className="flex-1"
                    />
                    <Button
                      label="Eliminar"
                      icon="trash"
                      variant="danger"
                      onPress={() => setConfirmandoEliminar(true)}
                      className="flex-1"
                    />
                  </View>
                )}
              </Card>
            ) : null}

            <Card className="gap-3">
              <View className="flex-row items-center gap-3">
                <Avatar
                  uri={null}
                  nombre={maskNombreUsuario(oferta.profiles?.nombre, "Usu****", esPropia)}
                  size={44}
                />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-ink">
                    {maskNombreUsuario(oferta.profiles?.nombre, "Usu****", esPropia)}
                  </Text>
                  <Text className="text-xs text-ink-muted">
                    {esPropia
                      ? `Los demás usuarios te ven como ${maskNombreUsuario(oferta.profiles?.nombre)}`
                      : "Usuario verificado · Datos protegidos"}
                  </Text>
                </View>
                <Icon name="badgeCheck" size={18} className="text-sage-500" />
              </View>

              <View className="flex-row items-center gap-2 rounded-2xl bg-sage-50/70 px-3 py-2">
                <Icon name="lock" size={13} className="text-sage-600" />
                <Text className="flex-1 text-[11px] leading-4 text-sage-800">
                  Canal interno protegido: las consultas son anónimas y no está permitido compartir teléfonos, correos ni redes.
                </Text>
              </View>

              {!user ? (
                <View className="flex-row items-center gap-2 rounded-2xl border border-sage-200 bg-sage-50/90 px-3 py-2">
                  <Icon name="info" size={14} className="text-sage-700" />
                  <Text className="flex-1 text-[11px] leading-4 text-sage-800">
                    Iniciá sesión o registrate gratis para consultar directamente por este lote o cotizar flete.
                  </Text>
                </View>
              ) : null}

              <View className="flex-row gap-2">
                <Button
                  label={esPropia ? "Ver consultas" : "Consultar por chat"}
                  icon="message"
                  onPress={irAlChat}
                  className="flex-1"
                />
                <Button
                  label="Pedir flete"
                  icon="truck"
                  variant="secondary"
                  onPress={pedirFlete}
                  className="flex-1"
                />
              </View>

              <Button
                label="Compartir en redes sociales"
                icon="share"
                variant="soft"
                onPress={() => setShareModalVisible(true)}
              />
            </Card>
          </View>
        </View>
      </Screen>

      <ShareOfferModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        oferta={oferta}
        portadaUrl={activo?.url ?? portada?.url ?? todos[0]?.url}
      />

      <AuthPromptModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        motivo={authModalMotivo}
        returnUrl={`/oferta/${oferta.id}`}
        ofertaSummary={{
          categoria: oferta.categoria,
          raza: oferta.raza,
          cantidad: oferta.cantidad,
          precio: oferta.precio,
          tipo_precio: oferta.tipo_precio,
        }}
      />
    </View>
  );
}

/** Imagen de la media (foto o miniatura del video). */
function MediaImagen({
  url,
  tipo = "foto",
  className = "",
}: {
  url?: string | null;
  tipo?: "foto" | "video";
  className?: string;
}) {
  if (!url) return <View className={`h-full w-full bg-surface-sunk ${className}`} />;
  if (tipo === "video") {
    const { inicio } = parseVideoTrimUrl(url);
    if (Platform.OS === "web") {
      return (
        <View className={`overflow-hidden bg-ink ${className}`}>
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = inicio ?? 0.1;
            }}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />
        </View>
      );
    }
    return <View className={`overflow-hidden bg-ink ${className}`} />;
  }
  return (
    <View className={`overflow-hidden bg-surface-sunk ${className}`}>
      <Image source={{ uri: url }} className="h-full w-full" />
    </View>
  );
}
