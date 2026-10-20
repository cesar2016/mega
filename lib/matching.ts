/**
 * Utilidades de matching en el cliente.
 *
 * Réplica de las reglas de puntaje de las funciones `calcular_matches_oferta` /
 * `calcular_matches_demanda` de Postgres (categoría 30, raza 20, distancia 30,
 * peso 15, precio 5; se crea el match con 60 o más) para poder explicarle al
 * usuario POR QUÉ le apareció cada cruce.
 */

import type { OfertaMediaRow } from "components/ui/OfertaMedia";

export type Punto = { lon: number; lat: number };
export type RazonMatch = {
  clave: "categoria" | "raza" | "distancia" | "peso" | "precio";
  etiqueta: string;
  detalle?: string;
  puntos: number;
};

export type OfertaMatch = {
  id: string;
  productor_id?: string | null;
  categoria: string;
  raza?: string | null;
  cantidad?: number | null;
  peso_promedio?: number | null;
  precio?: number | null;
  tipo_precio?: string | null;
  ubicacion?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  estado?: string | null;
  profiles?: { nombre?: string | null; avatar_url?: string | null } | null;
  oferta_media?: OfertaMediaRow[] | null;
};

export type DemandaMatch = {
  id: string;
  comprador_id?: string | null;
  categoria: string;
  raza?: string | null;
  cantidad_min?: number | null;
  cantidad_max?: number | null;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
  precio_max?: number | null;
  tipo_precio?: string | null;
  ubicacion?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  radio_km?: number | null;
  estado?: string | null;
  profiles?: { nombre?: string | null; avatar_url?: string | null } | null;
};

/**
 * Decodifica el punto `geography` de PostGIS (WKB en hexadecimal) a lon/lat.
 * Formato: byte order (1 byte) + tipo (4) + SRID (4) + X (8) + Y (8).
 */
export function decodeGeografia(hex?: string | null): Punto | null {
  if (!hex) return null;
  const limpio = hex.trim();
  if (limpio.length < 42 || limpio.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(limpio)) return null;

  const bytes = new Uint8Array(limpio.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(limpio.slice(i * 2, i * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const tipo = view.getUint32(1, littleEndian);
  const conSrid = (tipo & 0x20000000) !== 0;
  const offset = conSrid ? 9 : 5;
  if (bytes.length < offset + 16) return null;

  const lon = view.getFloat64(offset, littleEndian);
  const lat = view.getFloat64(offset + 8, littleEndian);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lon, lat };
}

/** Distancia en línea recta entre dos puntos (fórmula de Haversine). */
export function distanciaKm(a: Punto, b: Punto): number {
  const radioTierra = 6371;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * radioTierra * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Desglose del puntaje de un match: devuelve sólo los criterios que sumando
 * puntos (misma lógica que la función SQL del matching).
 */
export function razonesMatch(
  oferta: OfertaMatch | null,
  demanda: DemandaMatch | null,
): RazonMatch[] {
  const razones: RazonMatch[] = [];
  if (!oferta || !demanda) return razones;

  if (oferta.categoria && oferta.categoria === demanda.categoria) {
    razones.push({ clave: "categoria", etiqueta: "Misma categoría", puntos: 30 });
  }

  if (oferta.raza && oferta.raza === demanda.raza) {
    razones.push({ clave: "raza", etiqueta: "Misma raza", puntos: 20 });
  }

  const origen = decodeGeografia(oferta.ubicacion);
  const destino = decodeGeografia(demanda.ubicacion);
  if (origen && destino && demanda.radio_km) {
    const km = distanciaKm(origen, destino);
    if (km <= Number(demanda.radio_km)) {
      razones.push({
        clave: "distancia",
        etiqueta: "Dentro del radio de búsqueda",
        detalle: `a ${Math.round(km)} km`,
        puntos: 30,
      });
    }
  }

  if (
    oferta.peso_promedio != null &&
    demanda.peso_min_kg != null &&
    demanda.peso_max_kg != null
  ) {
    const medio = (Number(demanda.peso_min_kg) + Number(demanda.peso_max_kg)) / 2;
    if (Math.abs(Number(oferta.peso_promedio) - medio) <= 50) {
      razones.push({ clave: "peso", etiqueta: "Peso en el rango buscado", puntos: 15 });
    }
  }

  if (
    demanda.precio_max != null &&
    oferta.precio != null &&
    Math.abs(Number(oferta.precio) - Number(demanda.precio_max)) <= 100
  ) {
    razones.push({ clave: "precio", etiqueta: "Precio dentro del presupuesto", puntos: 5 });
  }

  return razones;
}

/** Etiqueta del puntaje: 80+ es un cruce excelente, 60+ un cruce posible. */
export function nivelMatch(puntaje: number): { etiqueta: string; tone: "sage" | "wheat" | "neutral" } {
  if (puntaje >= 80) return { etiqueta: "Excelente cruce", tone: "sage" };
  if (puntaje >= 70) return { etiqueta: "Muy buen cruce", tone: "sage" };
  if (puntaje >= 60) return { etiqueta: "Cruce posible", tone: "wheat" };
  return { etiqueta: "Cruce flojo", tone: "neutral" };
}
