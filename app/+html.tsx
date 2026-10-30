import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Mercado Ganadero</title>
        <meta name="description" content="Mercado Ganadero: plataforma digital para la compra y venta de hacienda en Argentina." />

        {/* Open Graph por defecto para Facebook, WhatsApp, etc. */}
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

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Mercado Ganadero · Compra y venta de hacienda" />
        <meta name="twitter:description" content="Plataforma digital para la compra y venta de hacienda en Argentina." />
        <meta name="twitter:image" content="https://mercadoganadero.app/og-banner.jpg" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
