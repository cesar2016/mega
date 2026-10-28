const fs = require("fs");
const path = require("path");

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatPrecio(precio, tipo_precio) {
  const num = Number(precio);
  const formatted = isNaN(num) ? String(precio) : `$${num.toLocaleString("es-AR")}`;
  if (tipo_precio === "por_kilo") return `${formatted} / kg`;
  if (tipo_precio === "por_cabeza") return `${formatted} / cab.`;
  return formatted;
}

module.exports = async function handler(req, res) {
  const { id } = req.query;
  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    "mercadoganadero.vercel.app";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const canonicalUrl = `${protocol}://${host}/oferta/${id || ""}`;
  const defaultImage = `${protocol}://${host}/og-banner.png`;

  let titulo = "Mercado Ganadero";
  let descripcion =
    "Plataforma digital para la compra y venta de hacienda en Argentina.";
  let imagenUrl = defaultImage;

  if (id) {
    try {
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        "https://kkoctmvglhjayjtiepgh.supabase.co";
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrb2N0bXZnbGhqYXlqdGllcGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzEwNzAsImV4cCI6MjEwNzc0NzA3MH0.qoQWz-5nqAdxnuYe0raj-j_aJoND98nyOmX4h_9KGzg";

      const response = await fetch(
        `${supabaseUrl}/rest/v1/ofertas?id=eq.${id}&select=id,categoria,raza,cantidad,precio,tipo_precio,peso_promedio,localidad,provincia,oferta_media(url,es_portada,tipo)`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const oferta = Array.isArray(data) ? data[0] : null;

        if (oferta) {
          titulo = `Lote de ${oferta.categoria || "hacienda"} (${oferta.cantidad || 0} cab.) - Mercado Ganadero`;
          const precioStr = formatPrecio(oferta.precio, oferta.tipo_precio);
          const ubicacion = [oferta.localidad, oferta.provincia]
            .filter(Boolean)
            .join(", ");
          descripcion = [
            oferta.raza || `Lote de ${oferta.categoria}`,
            `${oferta.cantidad} cabezas`,
            precioStr,
            oferta.peso_promedio ? `${oferta.peso_promedio} kg prom.` : null,
            ubicacion || null,
          ]
            .filter(Boolean)
            .join(" · ");

          const media = Array.isArray(oferta.oferta_media)
            ? oferta.oferta_media
            : [];
          const portada =
            media.find((m) => m.es_portada && m.url) ||
            media.find((m) => m.tipo === "foto" && m.url) ||
            media[0];

          if (portada?.url) {
            imagenUrl = portada.url.split("#")[0];
          }
        }
      }
    } catch (err) {
      console.error("Error al consultar oferta para OG:", err);
    }
  }

  // Leer index.html de dist/ si existe
  let html = "";
  try {
    const indexPath = path.join(process.cwd(), "dist", "index.html");
    if (fs.existsSync(indexPath)) {
      html = fs.readFileSync(indexPath, "utf8");
    }
  } catch (_err) {
    // Si no está disponible en disco, se usará el fallback
  }

  const metaTags = `
    <title>${escapeHtml(titulo)}</title>
    <meta name="description" content="${escapeHtml(descripcion)}" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Mercado Ganadero" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(titulo)}" />
    <meta property="og:description" content="${escapeHtml(descripcion)}" />
    <meta property="og:image" content="${escapeHtml(imagenUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(imagenUrl)}" />
    <meta property="og:image:alt" content="${escapeHtml(titulo)}" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(titulo)}" />
    <meta name="twitter:description" content="${escapeHtml(descripcion)}" />
    <meta name="twitter:image" content="${escapeHtml(imagenUrl)}" />
  `;

  if (html && html.includes("<head>")) {
    let modifiedHtml = html.replace(/<title>.*?<\/title>/gi, "");
    modifiedHtml = modifiedHtml.replace(/<meta property="og:[^>]*>/gi, "");
    modifiedHtml = modifiedHtml.replace(/<meta name="twitter:[^>]*>/gi, "");
    modifiedHtml = modifiedHtml.replace("<head>", `<head>${metaTags}`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res.status(200).send(modifiedHtml);
  }

  const fallbackHtml = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    ${metaTags}
  </head>
  <body>
    <div id="root">Cargando publicación...</div>
    <script>window.location.replace("/index.html");</script>
  </body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
  return res.status(200).send(fallbackHtml);
};
