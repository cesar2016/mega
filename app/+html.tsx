import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Mercado Ganadero — Compra y venta de hacienda</title>
        <meta
          name="description"
          content="Compra y venta directa de hacienda y lotes ganaderos en Argentina."
        />

        {/* Configuración PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2E5A3C" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Mercado Ganadero" />

        {/* Configuración iOS / Safari Standalone App */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Mercado Ganadero" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
