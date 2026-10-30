import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexPath)) {
  console.error("inject-og: dist/index.html no existe. Omitiendo inyección.");
  process.exit(0);
}

// Asegurar que los banners optimizados existan en dist/
const publicDir = path.join(rootDir, "public");
for (const file of ["og-banner.jpg", "og-banner.png"]) {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

let html = fs.readFileSync(indexPath, "utf8");

const metaTags = `
    <title>Mercado Ganadero · Compra y venta de hacienda</title>
    <meta name="description" content="Plataforma digital para la compra y venta de hacienda en Argentina. Publicá tus lotes, conectá con compradores directos y gestioná tus operaciones de forma simple." />

    <!-- Meta / Facebook App ID -->
    <meta property="fb:app_id" content="966242223397117" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mercado Ganadero" />
    <meta property="og:url" content="https://mercadoganadero.app/" />
    <meta property="og:title" content="Mercado Ganadero · Compra y venta de hacienda" />
    <meta property="og:description" content="Plataforma digital para la compra y venta de hacienda en Argentina. Publicá tus lotes, conectá con compradores directos y gestioná tus operaciones de forma simple." />
    <meta property="og:image" content="https://mercadoganadero.app/og-banner.jpg" />
    <meta property="og:image:secure_url" content="https://mercadoganadero.app/og-banner.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Mercado Ganadero · Compra y venta de hacienda" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Mercado Ganadero · Compra y venta de hacienda" />
    <meta name="twitter:description" content="Plataforma digital para la compra y venta de hacienda en Argentina." />
    <meta name="twitter:image" content="https://mercadoganadero.app/og-banner.jpg" />
`;

// Limpiar títulos o metas duplicados si existieran
html = html.replace(/<title>.*?<\/title>/gi, "");
html = html.replace(/<meta property="og:[^>]*>/gi, "");
html = html.replace(/<meta name="twitter:[^>]*>/gi, "");
html = html.replace(/<meta name="description"[^>]*>/gi, "");
html = html.replace("<head>", `<head>${metaTags}`);

fs.writeFileSync(indexPath, html, "utf8");
console.log("inject-og: Etiquetas Open Graph inyectadas exitosamente en dist/index.html");
