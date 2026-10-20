/** Fila de `oferta_media` tal como la devuelve Supabase. */
export type OfertaMediaRow = {
  id: string;
  tipo: "foto" | "video";
  url: string | null;
  orden: number;
  es_portada: boolean;
  duracion_segundos: number | null;
};

/** Fotos y videos con URL, ordenados por `orden`. */
export function mediaOrdenado(media?: OfertaMediaRow[] | null): OfertaMediaRow[] {
  if (!media?.length) return [];
  return media
    .filter((item) => Boolean(item.url))
    .slice()
    .sort((a, b) => a.orden - b.orden);
}

export function fotosDe(media?: OfertaMediaRow[] | null): OfertaMediaRow[] {
  return mediaOrdenado(media).filter((item) => item.tipo === "foto");
}

export function videosDe(media?: OfertaMediaRow[] | null): OfertaMediaRow[] {
  return mediaOrdenado(media).filter((item) => item.tipo === "video");
}

/**
 * Imagen que se usa como portada de la publicación: la elegida por el
 * productor (`es_portada`) o, si no hay, la primera foto.
 */
export function portadaDe(media?: OfertaMediaRow[] | null): OfertaMediaRow | null {
  const fotos = fotosDe(media);
  if (fotos.length === 0) return null;
  return fotos.find((foto) => foto.es_portada) ?? fotos[0];
}
