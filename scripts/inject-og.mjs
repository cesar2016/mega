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

// Asegurar que los banners optimizados, manifest, service worker e íconos PWA existan en dist/
const publicDir = path.join(rootDir, "public");
for (const file of [
  "og-banner.jpg",
  "og-banner.png",
  "og-banner-v2.jpg",
  "og-banner-v2.png",
  "logo.png",
  "logo_email.png",
  "logo_mega.png",
  "manifest.json",
  "sw.js",
]) {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

const iconsSrcDir = path.join(publicDir, "icons");
const iconsDestDir = path.join(distDir, "icons");
if (fs.existsSync(iconsSrcDir)) {
  fs.mkdirSync(iconsDestDir, { recursive: true });
  for (const iconFile of fs.readdirSync(iconsSrcDir)) {
    fs.copyFileSync(
      path.join(iconsSrcDir, iconFile),
      path.join(iconsDestDir, iconFile)
    );
  }
}

let html = fs.readFileSync(indexPath, "utf8");

const metaTags = `
    <title>Mercado Ganadero · Compra y venta de hacienda</title>
    <meta name="description" content="Plataforma digital para la compra y venta de hacienda en Argentina. Publicá tus lotes, conectá con compradores directos y gestioná tus operaciones de forma simple." />

    <!-- PWA Manifest & Mobile App Capabilities -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#2E5A3C" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="Mercado Ganadero" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Mercado Ganadero" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />

    <script>
      window.__deferredPwaPrompt = null;
      window.addEventListener("beforeinstallprompt", function (e) {
        e.preventDefault();
        window.__deferredPwaPrompt = e;
        window.dispatchEvent(new Event("pwa-prompt-ready"));
      });
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/sw.js").catch(function () {});
        });
      }
    </script>

    <!-- Meta / Facebook App ID -->
    <meta property="fb:app_id" content="966242223397117" />

    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mercado Ganadero" />
    <meta property="og:url" content="https://mercadoganadero.app/" />
    <meta property="og:title" content="Mercado Ganadero · Compra y venta de hacienda" />
    <meta property="og:description" content="Plataforma digital para la compra y venta de hacienda en Argentina. Publicá tus lotes, conectá con compradores directos y gestioná tus operaciones de forma simple." />
    <meta property="og:image" content="https://mercadoganadero.app/og-banner-v2.jpg" />
    <meta property="og:image:secure_url" content="https://mercadoganadero.app/og-banner-v2.jpg" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Mercado Ganadero · Compra y venta de hacienda" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Mercado Ganadero · Compra y venta de hacienda" />
    <meta name="twitter:description" content="Plataforma digital para la compra y venta de hacienda en Argentina." />
    <meta name="twitter:image" content="https://mercadoganadero.app/og-banner-v2.jpg" />
`;

// Limpiar títulos o metas duplicados si existieran
html = html.replace(/<title>.*?<\/title>/gi, "");
html = html.replace(/<meta property="og:[^>]*>/gi, "");
html = html.replace(/<meta name="twitter:[^>]*>/gi, "");
html = html.replace(/<meta name="description"[^>]*>/gi, "");
html = html.replace("<head>", `<head>${metaTags}`);

fs.writeFileSync(indexPath, html, "utf8");
console.log("inject-og: Etiquetas Open Graph y PWA inyectadas exitosamente en dist/index.html");
