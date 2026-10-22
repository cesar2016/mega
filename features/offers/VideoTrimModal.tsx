import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Icon } from "components/ui/Icon";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { MAX_VIDEO_DURATION } from "./useOfferMedia";
import type { OfferMedia } from "./useOfferMedia";

export type VideoTrimResult = {
  duracion: number;
  duracionOriginal: number;
  trimInicio: number;
  trimFin: number;
};

type VideoTrimModalProps = {
  visible: boolean;
  uri: string;
  initialDuracion?: number;
  initialInicio?: number;
  initialFin?: number;
  esEdicionVideo?: boolean;
  onCancel: () => void;
  onConfirm: (result: VideoTrimResult) => void;
};

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatSeg(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return "0.0s";
  return `${seg.toFixed(1)}s`;
}

/**
 * Modal interactivo para previsualizar y recortar un video hasta `MAX_VIDEO_DURATION` (20s).
 * Funciona tanto al subir un video nuevo como al editar uno ya cargado en la publicación.
 */
export function VideoTrimModal({
  visible,
  uri,
  initialDuracion = 0,
  initialInicio = 0,
  initialFin,
  esEdicionVideo = false,
  onCancel,
  onConfirm,
}: VideoTrimModalProps) {
  const duracionEstimadaInicial =
    initialDuracion > 0 ? initialDuracion : MAX_VIDEO_DURATION;

  const [duracionTotal, setDuracionTotal] = useState<number>(duracionEstimadaInicial);
  const [inicio, setInicio] = useState<number>(initialInicio);
  const [fin, setFin] = useState<number>(
    initialFin ?? Math.min(duracionEstimadaInicial, initialInicio + MAX_VIDEO_DURATION)
  );
  const [tiempoActual, setTiempoActual] = useState<number>(initialInicio);
  const [reproduciendo, setReproduciendo] = useState<boolean>(true);
  const [silenciado, setSilenciado] = useState<boolean>(true);
  const [metadataCargada, setMetadataCargada] = useState<boolean>(false);

  const webVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!visible) return;
    const baseTotal = initialDuracion > 0 ? initialDuracion : MAX_VIDEO_DURATION;
    const ini = clamp(initialInicio ?? 0, 0, Math.max(0, baseTotal - 0.5));
    const finCalc =
      initialFin !== undefined && initialFin > ini
        ? clamp(initialFin, ini + 0.5, Math.min(baseTotal, ini + MAX_VIDEO_DURATION))
        : Math.min(baseTotal, ini + MAX_VIDEO_DURATION);

    setDuracionTotal(baseTotal);
    setInicio(ini);
    setFin(finCalc);
    setTiempoActual(ini);
    setReproduciendo(true);
    setMetadataCargada(false);
  }, [visible, uri, initialDuracion, initialInicio, initialFin]);

  const cambiarInicio = (nuevoInicioRaw: number) => {
    const maxInicio = Math.max(0, duracionTotal - 0.5);
    const nuevoInicio = Number(clamp(nuevoInicioRaw, 0, maxInicio).toFixed(1));
    let nuevoFin = fin;

    if (nuevoFin <= nuevoInicio + 0.5) {
      nuevoFin = Number(clamp(nuevoInicio + 1, 0.5, duracionTotal).toFixed(1));
    }
    if (nuevoFin - nuevoInicio > MAX_VIDEO_DURATION) {
      nuevoFin = Number(
        clamp(nuevoInicio + MAX_VIDEO_DURATION, nuevoInicio + 0.5, duracionTotal).toFixed(1)
      );
    }

    setInicio(nuevoInicio);
    setFin(nuevoFin);
    buscarSegundo(nuevoInicio);
  };

  const cambiarFin = (nuevoFinRaw: number) => {
    const nuevoFin = Number(clamp(nuevoFinRaw, 0.5, duracionTotal).toFixed(1));
    let nuevoInicio = inicio;

    if (nuevoInicio >= nuevoFin - 0.5) {
      nuevoInicio = Number(clamp(nuevoFin - 1, 0, nuevoFin - 0.5).toFixed(1));
    }
    if (nuevoFin - nuevoInicio > MAX_VIDEO_DURATION) {
      nuevoInicio = Number(clamp(nuevoFin - MAX_VIDEO_DURATION, 0, nuevoFin - 0.5).toFixed(1));
    }

    setInicio(nuevoInicio);
    setFin(nuevoFin);
    buscarSegundo(Math.max(nuevoInicio, nuevoFin - 0.5));
  };

  const buscarSegundo = (seg: number) => {
    setTiempoActual(seg);
    if (Platform.OS === "web" && webVideoRef.current) {
      try {
        webVideoRef.current.currentTime = seg;
      } catch {
        // Ignorar si aún no cargó metadata
      }
    }
  };

  const previsualizarRecorte = () => {
    buscarSegundo(inicio);
    if (Platform.OS === "web" && webVideoRef.current) {
      webVideoRef.current.play().catch(() => {});
      setReproduciendo(true);
    }
  };

  const alternarReproduccion = () => {
    if (Platform.OS === "web" && webVideoRef.current) {
      if (webVideoRef.current.paused) {
        if (
          webVideoRef.current.currentTime < inicio ||
          webVideoRef.current.currentTime >= fin
        ) {
          webVideoRef.current.currentTime = inicio;
        }
        webVideoRef.current.play().catch(() => {});
        setReproduciendo(true);
      } else {
        webVideoRef.current.pause();
        setReproduciendo(false);
      }
    } else {
      setReproduciendo((prev) => !prev);
    }
  };

  const duracionRecorte = Number(Math.max(0, fin - inicio).toFixed(1));
  const duracionRedondeada = Math.max(1, Math.round(duracionRecorte));
  const excedeMaximo = duracionRecorte > MAX_VIDEO_DURATION + 0.05;
  const esValido = duracionRecorte >= 0.5 && !excedeMaximo;

  const pctInicio = duracionTotal > 0 ? clamp((inicio / duracionTotal) * 100, 0, 100) : 0;
  const pctFin = duracionTotal > 0 ? clamp((fin / duracionTotal) * 100, 0, 100) : 100;
  const pctActual =
    duracionTotal > 0 ? clamp((tiempoActual / duracionTotal) * 100, pctInicio, pctFin) : 0;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-ink/70 p-4">
        <View className="max-h-[92%] w-full max-w-2xl overflow-hidden rounded-3xl border border-line bg-surface shadow-lift">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-line-soft px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-clay-50">
                <Icon name="video" size={19} className="text-clay-600" />
              </View>
              <View>
                <Text className="text-base font-bold text-ink">
                  {esEdicionVideo ? "Editar recorte de video" : "Vista previa y recorte de video"}
                </Text>
                <Text className="text-xs text-ink-muted">
                  Seleccioná un fragmento de hasta {MAX_VIDEO_DURATION} segundos
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cerrar vista previa"
              className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft active:bg-surface-sunk"
            >
              <Icon name="x" size={16} className="text-ink-soft" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5 py-4"
            contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Aviso si el video original supera los 20s */}
            {duracionTotal > MAX_VIDEO_DURATION ? (
              <View className="flex-row items-center gap-2.5 rounded-2xl border border-wheat-300 bg-wheat-50 px-3.5 py-2.5">
                <Icon name="info" size={16} className="text-wheat-700" />
                <Text className="flex-1 text-xs font-medium text-ink-soft">
                  El video original dura{" "}
                  <Text className="font-bold text-ink">{formatSeg(duracionTotal)}</Text>. Ajustá el
                  inicio y fin abajo para conservar un recorte de hasta{" "}
                  <Text className="font-bold text-ink">{MAX_VIDEO_DURATION}s</Text>.
                </Text>
              </View>
            ) : null}

            {/* Reproductor de vista previa */}
            <View className="relative h-64 w-full overflow-hidden rounded-2xl border border-line-soft bg-ink md:h-72">
              {Platform.OS === "web" ? (
                <video
                  ref={webVideoRef}
                  src={uri}
                  autoPlay
                  muted={silenciado}
                  playsInline
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    const realDur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : duracionEstimadaInicial;
                    setDuracionTotal(realDur);
                    const ini = clamp(initialInicio ?? 0, 0, Math.max(0, realDur - 0.5));
                    const finInicial =
                      initialFin !== undefined && initialFin > ini
                        ? clamp(initialFin, ini + 0.5, Math.min(realDur, ini + MAX_VIDEO_DURATION))
                        : Math.min(realDur, ini + MAX_VIDEO_DURATION);
                    setInicio(Number(ini.toFixed(1)));
                    setFin(Number(finInicial.toFixed(1)));
                    setTiempoActual(Number(ini.toFixed(1)));
                    setMetadataCargada(true);
                    el.currentTime = ini;
                    el.play().catch(() => {});
                  }}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    setTiempoActual(el.currentTime);
                    if (el.currentTime >= fin || el.currentTime < inicio - 0.25) {
                      el.currentTime = inicio;
                      if (!el.paused) {
                        el.play().catch(() => {});
                      }
                    }
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    backgroundColor: "#111915",
                  }}
                />
              ) : (
                <NativeTrimPreview
                  uri={uri}
                  inicio={inicio}
                  fin={fin}
                  reproduciendo={reproduciendo}
                  silenciado={silenciado}
                  onDurationDetected={(realDur) => {
                    if (!metadataCargada && realDur > 0) {
                      setDuracionTotal(realDur);
                      const ini = clamp(initialInicio ?? 0, 0, Math.max(0, realDur - 0.5));
                      const finInicial =
                        initialFin !== undefined && initialFin > ini
                          ? clamp(initialFin, ini + 0.5, Math.min(realDur, ini + MAX_VIDEO_DURATION))
                          : Math.min(realDur, ini + MAX_VIDEO_DURATION);
                      setInicio(Number(ini.toFixed(1)));
                      setFin(Number(finInicial.toFixed(1)));
                      setMetadataCargada(true);
                    }
                  }}
                  onTimeChange={setTiempoActual}
                />
              )}

              {/* Controles flotantes sobre el video */}
              <View className="absolute bottom-3 left-3 right-3 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={alternarReproduccion}
                    accessibilityRole="button"
                    className="flex-row items-center gap-1.5 rounded-xl bg-ink/75 px-3 py-1.5"
                  >
                    <Icon
                      name={reproduciendo ? "ban" : "video"}
                      size={13}
                      className="text-white"
                    />
                    <Text className="text-xs font-semibold text-white">
                      {reproduciendo ? "Pausar" : "Reproducir"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setSilenciado((s) => !s)}
                    accessibilityRole="button"
                    className="rounded-xl bg-ink/75 px-2.5 py-1.5"
                  >
                    <Text className="text-xs font-semibold text-white">
                      {silenciado ? "🔇 Audio off" : "🔊 Audio on"}
                    </Text>
                  </Pressable>
                </View>

                <View className="rounded-xl bg-ink/75 px-2.5 py-1.5">
                  <Text className="text-xs font-bold text-white">
                    {formatSeg(tiempoActual)} / {formatSeg(duracionTotal)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Línea de tiempo visual del recorte */}
            <Card className="gap-4 bg-surface-soft" padded>
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Badge tone={excedeMaximo ? "clay" : "sage"} icon="video">
                    Recorte: {formatSeg(duracionRecorte)} (máx. {MAX_VIDEO_DURATION}s)
                  </Badge>
                  <Badge tone="neutral">
                    {formatSeg(inicio)} → {formatSeg(fin)}
                  </Badge>
                </View>

                <Pressable
                  onPress={previsualizarRecorte}
                  accessibilityRole="button"
                  className="flex-row items-center gap-1 rounded-xl border border-sage-300 bg-sage-50 px-3 py-1.5 active:bg-sage-100"
                >
                  <Icon name="refresh" size={13} className="text-sage-700" />
                  <Text className="text-xs font-semibold text-sage-700">
                    Probar desde el inicio
                  </Text>
                </Pressable>
              </View>

              {/* Barra visual de recorte */}
              <View className="gap-1.5">
                <View className="relative h-7 w-full overflow-hidden rounded-xl border border-line bg-surface-sunk">
                  {/* Ventana seleccionada */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${pctInicio}%`,
                      width: `${Math.max(2, pctFin - pctInicio)}%`,
                    }}
                    className="border-x-2 border-sage-600 bg-sage-500/35"
                  />
                  {/* Indicador de reproducción actual */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${pctActual}%`,
                      width: 3,
                    }}
                    className="bg-clay-500"
                  />
                </View>

                <View className="flex-row justify-between">
                  <Text className="text-[11px] text-ink-muted">0.0s</Text>
                  <Text className="text-[11px] font-semibold text-sage-700">
                    Fragmento activo: {formatSeg(inicio)} a {formatSeg(fin)}
                  </Text>
                  <Text className="text-[11px] text-ink-muted">{formatSeg(duracionTotal)}</Text>
                </View>
              </View>

              {/* Controles de Inicio y Fin */}
              <View className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Control de Inicio */}
                <View className="gap-2 rounded-2xl border border-line-soft bg-surface p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      Inicio del recorte
                    </Text>
                    <Text className="text-sm font-extrabold text-sage-700">
                      {formatSeg(inicio)}
                    </Text>
                  </View>

                  {Platform.OS === "web" ? (
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0.5, duracionTotal - 0.5)}
                      step={0.1}
                      value={inicio}
                      onChange={(e) => cambiarInicio(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#2E7D4F", cursor: "pointer" }}
                    />
                  ) : null}

                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <StepChip label="-1s" onPress={() => cambiarInicio(inicio - 1)} />
                    <StepChip label="-0.5s" onPress={() => cambiarInicio(inicio - 0.5)} />
                    <StepChip label="+0.5s" onPress={() => cambiarInicio(inicio + 0.5)} />
                    <StepChip label="+1s" onPress={() => cambiarInicio(inicio + 1)} />
                    <StepChip
                      label="Marcar actual"
                      highlight
                      onPress={() => cambiarInicio(tiempoActual)}
                    />
                  </View>
                </View>

                {/* Control de Fin */}
                <View className="gap-2 rounded-2xl border border-line-soft bg-surface p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                      Fin del recorte
                    </Text>
                    <Text className="text-sm font-extrabold text-sage-700">
                      {formatSeg(fin)}
                    </Text>
                  </View>

                  {Platform.OS === "web" ? (
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(0.5, duracionTotal)}
                      step={0.1}
                      value={fin}
                      onChange={(e) => cambiarFin(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#2E7D4F", cursor: "pointer" }}
                    />
                  ) : null}

                  <View className="flex-row flex-wrap items-center gap-1.5">
                    <StepChip label="-1s" onPress={() => cambiarFin(fin - 1)} />
                    <StepChip label="-0.5s" onPress={() => cambiarFin(fin - 0.5)} />
                    <StepChip label="+0.5s" onPress={() => cambiarFin(fin + 0.5)} />
                    <StepChip label="+1s" onPress={() => cambiarFin(fin + 1)} />
                    <StepChip
                      label="Marcar actual"
                      highlight
                      onPress={() => cambiarFin(tiempoActual)}
                    />
                  </View>
                </View>
              </View>

              {/* Atajos rápidos */}
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xs font-medium text-ink-muted">Atajos:</Text>
                <StepChip
                  label={`Primeros ${Math.min(MAX_VIDEO_DURATION, Math.round(duracionTotal))}s`}
                  onPress={() => {
                    setInicio(0);
                    setFin(Number(Math.min(duracionTotal, MAX_VIDEO_DURATION).toFixed(1)));
                    buscarSegundo(0);
                  }}
                />
                {duracionTotal > MAX_VIDEO_DURATION ? (
                  <StepChip
                    label={`Últimos ${MAX_VIDEO_DURATION}s`}
                    onPress={() => {
                      const ini = Number(
                        Math.max(0, duracionTotal - MAX_VIDEO_DURATION).toFixed(1)
                      );
                      setInicio(ini);
                      setFin(Number(duracionTotal.toFixed(1)));
                      buscarSegundo(ini);
                    }}
                  />
                ) : null}
              </View>
            </Card>
          </ScrollView>

          {/* Footer de acciones */}
          <View className="flex-row items-center justify-end gap-3 border-t border-line-soft bg-surface px-5 py-4">
            <Button label="Cancelar" variant="secondary" onPress={onCancel} />
            <Button
              label={
                esEdicionVideo
                  ? `Guardar recorte (${duracionRedondeada}s)`
                  : `Usar este video (${duracionRedondeada}s)`
              }
              icon="checkCircle"
              disabled={!esValido}
              onPress={() =>
                onConfirm({
                  duracion: duracionRedondeada,
                  duracionOriginal: Number(duracionTotal.toFixed(1)),
                  trimInicio: Number(inicio.toFixed(1)),
                  trimFin: Number(fin.toFixed(1)),
                })
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StepChip({
  label,
  onPress,
  highlight = false,
}: {
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={[
        "rounded-xl border px-2.5 py-1",
        highlight
          ? "border-sage-300 bg-sage-50 active:bg-sage-100"
          : "border-line bg-surface-soft active:bg-surface-sunk",
      ].join(" ")}
    >
      <Text
        className={[
          "text-[11px] font-semibold",
          highlight ? "text-sage-700" : "text-ink-soft",
        ].join(" ")}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function NativeTrimPreview({
  uri,
  inicio,
  fin,
  reproduciendo,
  silenciado,
  onDurationDetected,
  onTimeChange,
}: {
  uri: string;
  inicio: number;
  fin: number;
  reproduciendo: boolean;
  silenciado: boolean;
  onDurationDetected: (dur: number) => void;
  onTimeChange: (t: number) => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = silenciado;
    p.play();
  });

  useEffect(() => {
    player.muted = silenciado;
  }, [player, silenciado]);

  useEffect(() => {
    if (reproduciendo) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, reproduciendo]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (player.duration > 0) {
        onDurationDetected(player.duration);
      }
      const current = player.currentTime ?? 0;
      onTimeChange(current);
      if (current >= fin || current < inicio - 0.25) {
        player.currentTime = inicio;
      }
    }, 250);
    return () => clearInterval(timer);
  }, [player, inicio, fin, onDurationDetected, onTimeChange]);

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

/**
 * Tarjeta de miniatura de video en la galería de creación/edición.
 * Muestra un preview real del video, su duración recortada y botones para
 * editar el recorte o quitar el video.
 */
export function VideoGalleryCard({
  video,
  onEdit,
  onRemove,
}: {
  video: OfferMedia;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const tieneRecorte =
    (video.trimInicio !== undefined && video.trimInicio > 0.05) ||
    (video.trimFin !== undefined &&
      video.duracionOriginal !== undefined &&
      video.trimFin < video.duracionOriginal - 0.05);

  return (
    <View className="h-28 w-40 overflow-hidden rounded-2xl border border-line-soft bg-ink">
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Ver y recortar video"
        className="h-full w-full"
      >
        {Platform.OS === "web" ? (
          <video
            src={video.uri}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              e.currentTarget.currentTime = video.trimInicio ?? 0.1;
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
            }}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-ink">
            <Icon name="video" size={24} className="text-white/80" />
          </View>
        )}

        {/* Capa de ícono central */}
        <View className="absolute inset-0 items-center justify-center bg-ink/25">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-ink/65">
            <Icon name="video" size={14} className="text-white" />
          </View>
        </View>
      </Pressable>

      {/* Botón Editar / Recortar */}
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Recortar video"
        className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-lg bg-sage-600/90 px-2 py-1"
      >
        <Icon name="pencil" size={10} className="text-white" />
        <Text className="text-[10px] font-bold text-white">Recortar</Text>
      </Pressable>

      {/* Duración */}
      <View className="absolute bottom-1.5 right-1.5 rounded-lg bg-ink/75 px-1.5 py-0.5">
        <Text className="text-[10px] font-semibold text-white">
          {tieneRecorte && video.trimInicio !== undefined && video.trimFin !== undefined
            ? `${video.duracion ?? Math.round(video.trimFin - video.trimInicio)}s`
            : `${video.duracion ?? 0}s`}
        </Text>
      </View>

      {/* Botón Quitar */}
      <Pressable
        onPress={onRemove}
        accessibilityLabel="Quitar video"
        className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-ink/70"
      >
        <Icon name="x" size={12} className="text-white" />
      </Pressable>
    </View>
  );
}
