/**
 * Helpers para subir la media elegida con el picker al bucket de Storage.
 */

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/ogg": "ogv",
};

/** Extensión del archivo a partir del mime type (para la key en Storage). */
export function extensionForMime(mimeType?: string | null, fallback = "jpg"): string {
  if (!mimeType) return fallback;
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (EXTENSION_POR_MIME[mime]) return EXTENSION_POR_MIME[mime];
  const guess = mime.split("/")[1] ?? fallback;
  return guess.replace(/[^a-z0-9]/g, "") || fallback;
}

/**
 * Convierte la URI local del picker en un cuerpo válido para Storage.
 *
 * - Web: el picker devuelve un `data:` URI (base64). Supabase lo subiría como
 *   texto plano, así que hay que decodificarlo a `Blob`.
 * - Nativo: devuelve `file://...`, que Storage acepta tal cual.
 */
export async function toUploadBody(uri: string): Promise<Blob | string> {
  if (!uri.startsWith("data:")) return uri;
  const response = await fetch(uri);
  return await response.blob();
}

/**
 * Extrae un fotograma del video en el navegador para usarlo como miniatura OpenGraph.
 */
export async function extractVideoThumbnailBlob(
  uri: string,
  timeSec = 1
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.src = uri;
      video.muted = true;
      video.playsInline = true;
      video.currentTime = Math.max(0.1, timeSec || 1);
      const timer = setTimeout(() => resolve(null), 3500);
      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
        } catch (_e) {
          resolve(null);
        }
      };
      video.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
    } catch (_e) {
      resolve(null);
    }
  });
}

