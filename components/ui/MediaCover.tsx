import React, { useEffect, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Icon } from "./Icon";
import {
  fotosConPortadaPrimero,
  parseVideoTrimUrl,
  videosDe,
} from "./OfertaMedia";
import type { OfertaMediaRow } from "./OfertaMedia";

const SLIDE_INITIAL_DELAY_MS = 450;
const SLIDE_INTERVAL_MS = 1200;

/**
 * Portada de una publicación: muestra la imagen de portada en reposo y, al
 * estar el cursor encima (`hovered`), reproduce el video del lote (si tiene)
 * o va pasando por las imágenes cuando hay más de una.
 */
export function MediaCover({
  url,
  media,
  hovered,
  categoria,
  className = "",
  iconSize = 26,
  rounded = "rounded-2xl",
  showIndicators = true,
}: {
  url?: string | null;
  media?: OfertaMediaRow[] | null;
  hovered?: boolean;
  categoria?: string | null;
  className?: string;
  iconSize?: number;
  rounded?: string;
  showIndicators?: boolean;
}) {
  const [internalHovered, setInternalHovered] = useState(false);
  const [fotoIdx, setFotoIdx] = useState(0);
  const [videoIdx, setVideoIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const activoHover = hovered ?? internalHovered;
  const fotos = fotosConPortadaPrimero(media);
  const videos = videosDe(media);

  const tieneVideo = videos.length > 0 && !videoError;
  const tieneCarruselFotos = !tieneVideo && fotos.length > 1;
  const portadaUrl = url ?? fotos[0]?.url ?? null;

  // Reiniciar estado de video al salir del hover o cambiar los videos
  useEffect(() => {
    if (!activoHover) {
      setVideoIdx(0);
      setVideoError(false);
    }
  }, [activoHover]);

  // Carrusel automático de imágenes en hover cuando no hay video y hay > 1 foto
  useEffect(() => {
    if (!activoHover || !tieneCarruselFotos) {
      setFotoIdx(0);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const firstTimer = setTimeout(() => {
      setFotoIdx((prev) => (prev + 1) % fotos.length);
      intervalId = setInterval(() => {
        setFotoIdx((prev) => (prev + 1) % fotos.length);
      }, SLIDE_INTERVAL_MS);
    }, SLIDE_INITIAL_DELAY_MS);

    return () => {
      clearTimeout(firstTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [activoHover, tieneCarruselFotos, fotos.length]);

  const webHoverProps =
    Platform.OS === "web" && hovered === undefined
      ? ({
          onMouseEnter: () => setInternalHovered(true),
          onMouseLeave: () => setInternalHovered(false),
        } as Record<string, unknown>)
      : {};

  // 1) Si tiene video y está en hover -> reproducir video (con portada de fondo mientras carga)
  if (tieneVideo && activoHover) {
    const videoActual = videos[videoIdx % videos.length] ?? videos[0];
    if (videoActual?.url) {
      return (
        <View
          {...webHoverProps}
          className={`relative w-full overflow-hidden bg-ink ${rounded} ${className}`}
        >
          {portadaUrl ? (
            <Image
              source={{ uri: portadaUrl }}
              accessibilityIgnoresInvertColors
              className="absolute inset-0 h-full w-full"
            />
          ) : null}
          <HoverVideoPlayer
            key={videoActual.id}
            url={videoActual.url}
            hasMultipleVideos={videos.length > 1}
            onAdvance={() => setVideoIdx((prev) => (prev + 1) % videos.length)}
            onError={() => setVideoError(true)}
          />
        </View>
      );
    }
  }

  // 2) Si tiene más de una foto (y no está reproduciendo video) -> carrusel de fotos en hover
  if (fotos.length > 1) {
    const indiceActivo = activoHover ? fotoIdx % fotos.length : 0;
    return (
      <View
        {...webHoverProps}
        className={`relative w-full overflow-hidden bg-surface-sunk ${rounded} ${className}`}
      >
        {fotos.map((foto, idx) => (
          <Image
            key={foto.id}
            source={{ uri: foto.url ?? undefined }}
            accessibilityIgnoresInvertColors
            className="absolute inset-0 h-full w-full transition-opacity duration-300"
            style={{ opacity: idx === indiceActivo ? 1 : 0 }}
          />
        ))}

        {showIndicators && activoHover ? (
          <View
            pointerEvents="none"
            className="absolute bottom-2.5 left-3 flex-row items-center gap-1.5 rounded-full bg-ink/55 px-2 py-1"
          >
            {fotos.map((foto, idx) => (
              <View
                key={foto.id}
                className={
                  idx === indiceActivo
                    ? "h-1.5 w-3.5 rounded-full bg-white"
                    : "h-1.5 w-1.5 rounded-full bg-white/55"
                }
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  // 3) Portada estática (1 foto)
  if (portadaUrl) {
    return (
      <View
        {...webHoverProps}
        className={`relative w-full overflow-hidden bg-surface-sunk ${rounded} ${className}`}
      >
        <Image
          source={{ uri: portadaUrl }}
          accessibilityIgnoresInvertColors
          className="h-full w-full"
        />
      </View>
    );
  }

  // 4) Sin fotos pero con video en reposo -> mostrar primer cuadro del video en web
  if (tieneVideo && videos[0]?.url && Platform.OS === "web") {
    const { inicio } = parseVideoTrimUrl(videos[0].url);
    return (
      <View
        {...webHoverProps}
        className={`relative w-full overflow-hidden bg-ink ${rounded} ${className}`}
      >
        <video
          src={videos[0].url}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = inicio ?? 0.1;
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            pointerEvents: "none",
          }}
        />
      </View>
    );
  }

  // 5) Placeholder cuando el lote no tiene media
  return (
    <View
      {...webHoverProps}
      className={[
        "w-full items-center justify-center gap-1 bg-sage-50",
        rounded,
        className,
      ].join(" ")}
    >
      <Icon name="beef" size={iconSize} className="text-sage-400" />
      {categoria ? (
        <Text className="px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-sage-600">
          {categoria}
        </Text>
      ) : null}
    </View>
  );
}

function HoverVideoPlayer({
  url,
  hasMultipleVideos,
  onAdvance,
  onError,
}: {
  url: string;
  hasMultipleVideos: boolean;
  onAdvance: () => void;
  onError: () => void;
}) {
  const { cleanUrl, inicio, fin } = parseVideoTrimUrl(url);

  if (Platform.OS === "web") {
    return (
      <video
        ref={(el) => {
          if (el) el.muted = true;
        }}
        src={url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          el.muted = true;
          if (inicio !== undefined && inicio > 0) {
            el.currentTime = inicio;
          }
          el.play().catch(() => {});
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (fin !== undefined && el.currentTime >= fin) {
            if (hasMultipleVideos) {
              onAdvance();
            } else {
              el.currentTime = inicio ?? 0;
              el.play().catch(() => {});
            }
          } else if (inicio !== undefined && el.currentTime < inicio - 0.25) {
            el.currentTime = inicio;
          }
        }}
        onEnded={(e) => {
          if (hasMultipleVideos) {
            onAdvance();
          } else {
            const el = e.currentTarget;
            el.currentTime = inicio ?? 0;
            el.play().catch(() => {});
          }
        }}
        onError={onError}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          position: "relative",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />
    );
  }

  return (
    <HoverNativeVideoPlayer
      url={cleanUrl || url}
      inicio={inicio}
      fin={fin}
      hasMultipleVideos={hasMultipleVideos}
      onAdvance={onAdvance}
    />
  );
}

function HoverNativeVideoPlayer({
  url,
  inicio,
  fin,
  hasMultipleVideos,
  onAdvance,
}: {
  url: string;
  inicio?: number;
  fin?: number;
  hasMultipleVideos: boolean;
  onAdvance: () => void;
}) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = !hasMultipleVideos && inicio === undefined && fin === undefined;
    p.muted = true;
    if (inicio !== undefined && inicio > 0) {
      p.currentTime = inicio;
    }
    p.play();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const current = player.currentTime ?? 0;
      if (fin !== undefined && current >= fin) {
        if (hasMultipleVideos) {
          onAdvance();
        } else {
          player.currentTime = inicio ?? 0;
          player.play();
        }
      }
    }, 250);
    return () => clearInterval(timer);
  }, [player, inicio, fin, hasMultipleVideos, onAdvance]);

  return (
    <View className="h-full w-full">
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        nativeControls={false}
        contentFit="cover"
      />
    </View>
  );
}

