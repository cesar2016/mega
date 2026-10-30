/* eslint-env node */
const fs = require("fs");
const path = require("path");
const { Buffer } = require("buffer");

let sharp;
try {
  sharp = require("sharp");
} catch (_err) {
  // Fallback si sharp no está disponible
}

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatPrecio(precio, tipo_precio) {
  const num = Number(precio);
  const formatted = isNaN(num) ? String(precio) : `$${num.toLocaleString("es-AR")}`;
  if (tipo_precio === "por_kilo") return `${formatted} / kg`;
  if (tipo_precio === "por_cabeza") return `${formatted} / cab.`;
  return formatted;
}

function generateVideoCardSvg({ titulo, subtitulo, ubicacion, precio }) {
  const lineasDetalle = [ubicacion, precio, subtitulo].filter(Boolean).join(" · ");

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C1E16"/>
      <stop offset="50%" stop-color="#163828"/>
      <stop offset="100%" stop-color="#08140E"/>
    </linearGradient>
    <linearGradient id="btn" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#B45309"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1120" cy="90" r="340" fill="#1B4332" opacity="0.25"/>
  <circle cx="80" cy="560" r="260" fill="#1B4332" opacity="0.2"/>

  <!-- Logo header -->
  <g transform="translate(80, 60)">
    <rect width="48" height="48" rx="12" fill="#1B4332" stroke="#4ADE80" stroke-width="2"/>
    <text x="24" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#4ADE80" text-anchor="middle">MG</text>
    <text x="66" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="bold" fill="#FFFFFF" letter-spacing="1">MERCADO GANADERO</text>
  </g>

  <!-- Boton Play central -->
  <g transform="translate(600, 220)" filter="url(#shadow)">
    <circle cx="0" cy="0" r="62" fill="#4ADE80" opacity="0.15"/>
    <circle cx="0" cy="0" r="48" fill="#163828" stroke="#4ADE80" stroke-width="3"/>
    <polygon points="-10,-18 18,0 -10,18" fill="#4ADE80"/>
  </g>

  <!-- Badge Video -->
  <g transform="translate(500, 298)">
    <rect width="200" height="36" rx="18" fill="url(#btn)"/>
    <text x="100" y="23" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">VIDEO DEL LOTE</text>
  </g>

  <!-- Titulo y Detalle -->
  <g transform="translate(80, 410)">
    <text x="520" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${escapeXml(titulo)}</text>
    <text x="520" y="46" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500" fill="#A7F3D0" text-anchor="middle">${escapeXml(lineasDetalle)}</text>
  </g>

  <!-- Footer -->
  <g transform="translate(80, 560)">
    <text x="520" y="0" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#6EE7B7" opacity="0.8" text-anchor="middle">mercadoganadero.app · Plataforma de compra y venta de hacienda</text>
  </g>
</svg>
  `;
}

module.exports = async function handler(req, res) {
  const { id, url: customUrl } = req.query;

  let targetImageUrl = customUrl ? decodeURIComponent(customUrl) : null;
  let videoOffer = null;

  if (!targetImageUrl && id) {
    try {
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        "https://kkoctmvglhjayjtiepgh.supabase.co";
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzEwNzAsImV4cCI6MjEwNzc0NzA3MH0.qoQWz-5nqAdxnuYe0raj-j_aJoND98nyOmX4h_9KGzg";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(
        `${supabaseUrl}/rest/v1/ofertas?id=eq.${id}&select=id,categoria,raza,cantidad,precio,tipo_precio,peso_promedio,localidad,provincia,oferta_media(url,es_portada,tipo,orden)`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const oferta = data?.[0];
        if (oferta) {
          const media = Array.isArray(oferta.oferta_media) ? oferta.oferta_media : [];
          const fotos = media.filter((m) => m.tipo === "foto" && m.url);
          const videos = media.filter((m) => m.tipo === "video" && m.url);
          const fotoPortada = fotos.find((m) => m.es_portada) || fotos[0];
          const videoPortada = videos.find((m) => m.es_portada) || videos[0];

          if (fotoPortada?.url) {
            targetImageUrl = fotoPortada.url.split("#")[0];
          } else if (videoPortada?.url) {
            // No pasar video MP4 a sharp; generar tarjeta visual de video
            videoOffer = oferta;
          }
        }
      }
    } catch (err) {
      console.error("Error al buscar imagen de oferta:", err);
    }
  }

  // 1. Si tenemos foto de la oferta, procesarla y devolver JPEG optimizado (< 100KB)
  if (targetImageUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const imgRes = await fetch(targetImageUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (imgRes.ok) {
        const arrayBuf = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (sharp) {
          const optimized = await sharp(buffer)
            .resize(1200, 630, { fit: "cover", position: "centre" })
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
      console.error("Error al procesar foto para OG:", err);
    }
  }

  // 2. Si la oferta tiene solo video, generar tarjeta gráfica con los datos y badge de video
  if (videoOffer && sharp) {
    try {
      const cat = videoOffer.categoria || "Hacienda";
      const cant = videoOffer.cantidad ? `${videoOffer.cantidad} cabezas` : "";
      const titulo = [cat, cant].filter(Boolean).join(" · ");
      const subtitulo = videoOffer.peso_promedio ? `${videoOffer.peso_promedio} kg prom.` : "";
      const ubicacion = [videoOffer.localidad, videoOffer.provincia].filter(Boolean).join(", ");
      const precio = formatPrecio(videoOffer.precio, videoOffer.tipo_precio);

      const svgString = generateVideoCardSvg({
        titulo: `Lote de ${titulo}`,
        subtitulo,
        ubicacion,
        precio,
      });

      const videoCardBuf = await sharp(Buffer.from(svgString))
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Length", String(videoCardBuf.length));
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      );
      return res.status(200).send(videoCardBuf);
    } catch (err) {
      console.error("Error al generar tarjeta de video:", err);
    }
  }

  // 3. Fallback: imagen de marca por defecto optimizada (< 100KB)
  try {
    const bannerJpg = path.join(process.cwd(), "public", "og-banner.jpg");
    if (fs.existsSync(bannerJpg)) {
      const bannerBuf = fs.readFileSync(bannerJpg);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Length", String(bannerBuf.length));
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
      );
      return res.status(200).send(bannerBuf);
    }

    const bannerPng = path.join(process.cwd(), "public", "og-banner.png");
    if (fs.existsSync(bannerPng)) {
      const bannerBuf = fs.readFileSync(bannerPng);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Length", String(bannerBuf.length));
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
