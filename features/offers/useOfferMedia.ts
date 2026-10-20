import { useState, useCallback } from "react";
import { showToast } from "lib/utils";

export const MAX_IMAGES = 5;
export const MAX_VIDEOS = 2;
export const MAX_VIDEO_DURATION = 15; // segundos
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB en bytes

export type OfferMedia = {
  id: string;
  tipo: "foto" | "video";
  uri: string; // URI local o URL temporal
  url?: string; // URL pública de Supabase Storage (después de upload)
  mimeType?: string; // ej. "image/jpeg" (lo exige el bucket de Storage)
  duracion?: number; //Solo para video
  orden: number;
};

export type UseOfferMediaReturn = {
  fotos: OfferMedia[];
  videos: OfferMedia[];
  /** Id de la foto que se usa como portada (preview). */
  portadaId: string | null;
  setPortada: (id: string) => void;
  addPhoto: (uri: string, mimeType?: string) => void;
  addVideo: (uri: string, duracion: number, mimeType?: string) => void;
  removeMedia: (id: string) => void;
  clearAll: () => void;
  isMaxReached: (tipo: "foto" | "video") => boolean;
  totalMedia: () => number;
};

export function useOfferMedia(): UseOfferMediaReturn {
  const [fotos, setFotos] = useState<OfferMedia[]>([]);
  const [videos, setVideos] = useState<OfferMedia[]>([]);
  const [portadaId, setPortadaId] = useState<string | null>(null);

  // Generar IDs y órdenes automáticos
  const ultimoOrdenFoto = fotos.length > 0 ? Math.max(...fotos.map((f) => f.orden)) : 0;
  const ultimoOrdenVideo = videos.length > 0 ? Math.max(...videos.map((v) => v.orden)) : 0;

  const addPhoto = useCallback(
    (uri: string, mimeType?: string) => {
      if (fotos.length >= MAX_IMAGES) {
        showToast("Máximo " + MAX_IMAGES + " fotos permitidas", "error");
        return;
      }

      const nuevaFoto: OfferMedia = {
        id: crypto.randomUUID(),
        tipo: "foto",
        uri,
        mimeType,
        orden: ultimoOrdenFoto + 1,
      };
      setFotos((prev) => [...prev, nuevaFoto]);
      // La primera foto es la portada por defecto.
      if (portadaId === null) setPortadaId(nuevaFoto.id);
    },
    [fotos, ultimoOrdenFoto, portadaId]
  );

  const addVideo = useCallback(
    (uri: string, duracion: number, mimeType?: string) => {
      if (videos.length >= MAX_VIDEOS) {
        showToast("Máximo " + MAX_VIDEOS + " videos permitidos", "error");
        return;
      }

      if (duracion > MAX_VIDEO_DURATION) {
        showToast(
          "Los videos deben tener como máximo " + MAX_VIDEO_DURATION + " segundos",
          "error"
        );
        return;
      }

      const nuevaVideo: OfferMedia = {
        id: crypto.randomUUID(),
        tipo: "video",
        uri,
        mimeType,
        duracion,
        orden: ultimoOrdenVideo + 1,
      };
      setVideos((prev) => [...prev, nuevaVideo]);
    },
    [videos, ultimoOrdenVideo]
  );

  const removeMedia = useCallback((id: string) => {
    setFotos((prev) => prev.filter((f) => f.id !== id));
    setVideos((prev) => prev.filter((v) => v.id !== id));
    setPortadaId((actual) => {
      if (actual !== id) return actual;
      // Si se borra la portada, la siguiente foto pasa a ser la portada.
      const restantes = fotos.filter((f) => f.id !== id);
      return restantes.length > 0 ? restantes[0].id : null;
    });
  }, [fotos]);

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
    addVideo,
    removeMedia,
    clearAll,
    isMaxReached,
    totalMedia,
  };
}
