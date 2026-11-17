/**
 * Provincias argentinas y coordenadas de centroide aproximado para geolocalización
 * y cálculo de distancias (PostGIS geography POINT(lon lat)).
 */

export type Coordenada = {
  lat: number;
  lon: number;
};

export const PROVINCIAS_COORDENADAS: Record<string, Coordenada> = {
  "Buenos Aires": { lat: -36.6769, lon: -60.5588 },
  "Ciudad Autónoma de Buenos Aires": { lat: -34.6037, lon: -58.3816 },
  "Catamarca": { lat: -28.4696, lon: -65.7852 },
  "Chaco": { lat: -27.4514, lon: -58.9867 },
  "Chubut": { lat: -43.3002, lon: -65.1023 },
  "Córdoba": { lat: -31.4201, lon: -64.1888 },
  "Corrientes": { lat: -27.4692, lon: -58.8306 },
  "Entre Ríos": { lat: -32.0589, lon: -59.2014 },
  "Formosa": { lat: -26.1775, lon: -58.1781 },
  "Jujuy": { lat: -24.1858, lon: -65.2995 },
  "La Pampa": { lat: -36.6167, lon: -64.2833 },
  "La Rioja": { lat: -29.4135, lon: -66.8565 },
  "Mendoza": { lat: -32.8895, lon: -68.8458 },
  "Misiones": { lat: -27.3621, lon: -55.8967 },
  "Neuquén": { lat: -38.9516, lon: -68.0591 },
  "Río Negro": { lat: -40.8135, lon: -62.9967 },
  "Salta": { lat: -24.7821, lon: -65.4232 },
  "San Juan": { lat: -31.5375, lon: -68.5364 },
  "San Luis": { lat: -33.2950, lon: -66.3356 },
  "Santa Cruz": { lat: -51.6226, lon: -69.2181 },
  "Santa Fe": { lat: -31.6333, lon: -60.7000 },
  "Santiago del Estero": { lat: -27.7951, lon: -64.2615 },
  "Tierra del Fuego": { lat: -54.8019, lon: -68.3030 },
  "Tucumán": { lat: -26.8083, lon: -65.2176 },
};

export const LISTA_PROVINCIAS = [
  "Buenos Aires",
  "Córdoba",
  "Santa Fe",
  "Entre Ríos",
  "La Pampa",
  "Corrientes",
  "Chaco",
  "Santiago del Estero",
  "San Luis",
  "Mendoza",
  "Salta",
  "Tucumán",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chubut",
  "Formosa",
  "Jujuy",
  "La Rioja",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "San Juan",
  "Santa Cruz",
  "Tierra del Fuego",
];

/**
 * Obtiene las coordenadas de una provincia buscando coincidencias insensibles a mayúsculas/acentos.
 */
export function coordenadasProvincia(nombre?: string | null): Coordenada | null {
  if (!nombre) return null;
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const buscado = normalizar(nombre);
  for (const [prov, coord] of Object.entries(PROVINCIAS_COORDENADAS)) {
    if (normalizar(prov) === buscado || buscado.includes(normalizar(prov))) {
      return coord;
    }
  }
  return null;
}

/**
 * Genera el string WKT en formato POINT(lon lat) para PostGIS geography.
 * Nota: PostGIS usa primero longitud (X) y luego latitud (Y).
 */
export function puntoWKT(coord: Coordenada): string {
  return `POINT(${coord.lon.toFixed(6)} ${coord.lat.toFixed(6)})`;
}
