import { useState, useCallback } from "react";
import { showToast } from "lib/utils";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";

export const MAX_IMAGES = 5;
export const MAX_VIDEOS = 2;
export const MAX_VIDEO_DURATION = 15; // segundos
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB en bytes

function generarId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type OfferMedia = {
  id: string;
  tipo: "foto" | "video";
  uri: string; // URI local o URL pública
  url?: string; // URL pública de Supabase Storage (presente si ya está subida)
  mimeType?: string; // ej. "image/jpeg" (lo exige el bucket de Storage)
  duracion?: number; // Solo para video
  orden: number;
};

export type UseOfferMediaReturn = {
  fotos: OfferMedia[];
  videos: OfferMedia[];
  /** Id de la foto que se usa como portada (preview). */
  portadaId: string | null;
  setPortada: (id: string) => void;
  addPhoto: (uri: string, mimeType?: string) => void;
  addPhotos: (items: { uri: string; mimeType?: string }[]) => void;
  addVideo: (uri: string, duracion: number, mimeType?: string) => void;
  loadInitialMedia: (rows?: OfertaMediaRow[] | null) => void;
  removeMedia: (id: string) => void;
  clearAll: () => void;
  isMaxReached: (tipo: "foto" | "video") => boolean;
  totalMedia: () => number;
};

export function useOfferMedia(): UseOfferMediaReturn {
  const [fotos, setFotos] = useState<OfferMedia[]>([]);
  const [videos, setVideos] = useState<OfferMedia[]>([]);
  const [portadaId, setPortadaId] = useState<string | null>(null);

  const addPhotos = useCallback((items: { uri: string; mimeType?: string }[]) => {
    if (!items || items.length === 0) return;

    setFotos((prev) => {
      const disponibles = MAX_IMAGES - prev.length;
      if (disponibles <= 0) {
        showToast("Máximo " + MAX_IMAGES + " fotos permitidas", "error");
        return prev;
      }

      const seleccionadas = items.slice(0, disponibles);
      if (items.length > disponibles) {
        showToast(
          `Se agregaron ${disponibles} de ${items.length} fotos (máximo ${MAX_IMAGES})`,
          "info"
        );
      }

      const baseOrden = prev.length > 0 ? Math.max(...prev.map((f) => f.orden)) : 0;
      const nuevas: OfferMedia[] = seleccionadas.map((item, idx) => ({
        id: generarId(),
        tipo: "foto",
        uri: item.uri,
        mimeType: item.mimeType,
        orden: baseOrden + idx + 1,
      }));

      setPortadaId((actual) => actual ?? nuevas[0]?.id ?? null);
      return [...prev, ...nuevas];
    });
  }, []);

  const addPhoto = useCallback(
    (uri: string, mimeType?: string) => {
      addPhotos([{ uri, mimeType }]);
    },
    [addPhotos]
  );

  const addVideo = useCallback(
    (uri: string, duracion: number, mimeType?: string) => {
      if (duracion > MAX_VIDEO_DURATION) {
        showToast(
          "Los videos deben tener como máximo " + MAX_VIDEO_DURATION + " segundos",
          "error"
        );
        return;
      }

      setVideos((prev) => {
        if (prev.length >= MAX_VIDEOS) {
          showToast("Máximo " + MAX_VIDEOS + " videos permitidos", "error");
          return prev;
        }

        const baseOrden = prev.length > 0 ? Math.max(...prev.map((v) => v.orden)) : 0;
        const nuevoVideo: OfferMedia = {
          id: generarId(),
          tipo: "video",
          uri,
          mimeType,
          duracion,
          orden: baseOrden + 1,
        };
        return [...prev, nuevoVideo];
      });
    },
    []
  );

  const loadInitialMedia = useCallback((rows?: OfertaMediaRow[] | null) => {
    const ordenados = (rows ?? [])
      .filter((r) => Boolean(r.url))
      .slice()
      .sort((a, b) => a.orden - b.orden);

    const fotosIniciales: OfferMedia[] = ordenados
      .filter((r) => r.tipo === "foto")
      .map((r, idx) => ({
        id: r.id,
        tipo: "foto",
        uri: r.url ?? "",
        url: r.url ?? undefined,
        orden: idx + 1,
      }));

    const videosIniciales: OfferMedia[] = ordenados
      .filter((r) => r.tipo === "video")
      .map((r, idx) => ({
        id: r.id,
        tipo: "video",
        uri: r.url ?? "",
        url: r.url ?? undefined,
        duracion: r.duracion_segundos ?? 0,
        orden: idx + 1,
      }));

    const portadaRow = ordenados.find((r) => r.tipo === "foto" && r.es_portada);
    setFotos(fotosIniciales);
    setVideos(videosIniciales);
    setPortadaId(portadaRow?.id ?? fotosIniciales[0]?.id ?? null);
  }, []);

  const removeMedia = useCallback((id: string) => {
    setFotos((prev) => {
      const restantes = prev.filter((f) => f.id !== id);
      setPortadaId((actual) => {
        if (actual !== id) return actual;
        return restantes.length > 0 ? restantes[0].id : null;
      });
      return restantes;
    });
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setFotos([]);
    setVideos([]);
    setPortadaId(null);
  }, []);

  /** Elige la foto que se muestra en la preview de la publicación. */
  const setPortada = useCallback((id: string) => {
    setPortadaId(id);
  }, []);

  const isMaxReached = useCallback(
    (tipo: "foto" | "video") => {
      if (tipo === "foto") return fotos.length >= MAX_IMAGES;
      return videos.length >= MAX_VIDEOS;
    },
    [fotos, videos]
  );

  const totalMedia = useCallback(() => fotos.length + videos.length, [fotos, videos]);

  return {
    fotos,
    videos,
    portadaId,
    setPortada,
    addPhoto,
    addPhotos,
    addVideo,
    loadInitialMedia,
    removeMedia,
    clearAll,
    isMaxReached,
    totalMedia,
  };
}

