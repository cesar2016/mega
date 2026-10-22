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

/**
 * Extrae el rango de recorte `#t=inicio,fin` (Media Fragments URI) si existe en la URL.
 */
export function parseVideoTrimUrl(url?: string | null): {
  cleanUrl: string;
  inicio?: number;
  fin?: number;
} {
  if (!url) return { cleanUrl: "" };
  const [cleanUrl, hash] = url.split("#");
  if (!hash) return { cleanUrl };

  const match = hash.match(/(?:^|&)t=([0-9.]+)(?:,([0-9.]+))?/);
  if (!match) return { cleanUrl };

  const inicio = Number(match[1]);
  const fin = match[2] !== undefined ? Number(match[2]) : undefined;
  return {
    cleanUrl,
    inicio: Number.isFinite(inicio) ? inicio : undefined,
    fin: fin !== undefined && Number.isFinite(fin) ? fin : undefined,
  };
}

/**
 * Construye una URL con el fragmento `#t=inicio,fin` cuando se aplicó un recorte.
 */
export function buildVideoTrimUrl(
  url: string,
  inicio?: number,
  fin?: number,
  duracionOriginal?: number
): string {
  const { cleanUrl } = parseVideoTrimUrl(url);
  if (inicio === undefined || fin === undefined) return cleanUrl;

  const recortaInicio = inicio > 0.05;
  const recortaFin =
    duracionOriginal !== undefined ? fin < duracionOriginal - 0.05 : true;

  if (!recortaInicio && !recortaFin) {
    return cleanUrl;
  }

  return `${cleanUrl}#t=${Number(inicio.toFixed(1))},${Number(fin.toFixed(1))}`;
}

