/* eslint-env node */
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");

let sharp;
try {
  sharp = require("sharp");
} catch (_err) {
  // Fallback si sharp no está cargado
}

module.exports = async function handler(req, res) {
  const { id, url: customUrl } = req.query;

  let targetImageUrl = customUrl ? decodeURIComponent(customUrl) : null;

  if (!targetImageUrl && id) {
    try {
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        "https://kkoctmvglhjayjtiepgh.supabase.co";
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzEwNzAsImV4cCI6MjEwNzc0NzA3MH0.qoQWz-5nqAdxnuYe0raj-j_aJoND98nyOmX4h_9KGzg";

      const response = await fetch(
        `${supabaseUrl}/rest/v1/ofertas?id=eq.${id}&select=oferta_media(url,es_portada,tipo)`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const media = data?.[0]?.oferta_media || [];
        const portada =
          media.find((m) => m.es_portada && m.url) ||
          media.find((m) => m.tipo === "foto" && m.url) ||
          media[0];

        if (portada?.url) {
          targetImageUrl = portada.url.split("#")[0];
        }
      }
    } catch (err) {
      console.error("Error al buscar imagen de oferta:", err);
    }
  }

  // Si tenemos una URL de imagen, la descargamos y optimizamos para WhatsApp (< 300KB)
  if (targetImageUrl) {
    try {
      const imgRes = await fetch(targetImageUrl);
      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Si sharp está disponible, redimensionar a 800x600 y comprimir a JPEG < 100KB
        if (sharp) {
          const optimized = await sharp(buffer)
            .resize(800, 600, { fit: "cover", position: "centre" })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();

          res.setHeader("Content-Type", "image/jpeg");
          res.setHeader("Content-Length", String(optimized.length));
          res.setHeader(
            "Cache-Control",
            "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
          );
          return res.status(200).send(optimized);
        } else {
          res.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
          return res.status(200).send(buffer);
        }
      }
    } catch (err) {
      console.error("Error al procesar imagen para WhatsApp:", err);
    }
  }

  // Fallback: enviar imagen por defecto public/og-banner.png
  try {
    const bannerPath = path.join(process.cwd(), "public", "og-banner.png");
    if (fs.existsSync(bannerPath)) {
      const bannerBuf = fs.readFileSync(bannerPath);
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      );
      return res.status(200).send(bannerBuf);
    }
  } catch (_e) {
    //
  }

  return res.status(404).send("Image not found");
};
