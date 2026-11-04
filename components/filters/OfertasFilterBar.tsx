import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "components/ui/Icon";
import { Badge, Card } from "components/ui/Card";
import { decodeGeografia, distanciaKm } from "lib/matching";
import type { Punto } from "lib/matching";
import type { OfertaResumen } from "features/offers/OfferCard";

export const CATEGORIAS_ANIMALES = [
  "Novillos",
  "Novillitos",
  "Vaquillonas",
  "Terneros",
  "Vacas",
  "Toros",
  "Conserva",
  "Variados",
];

export const RADIOS_KM_OPCIONES = [50, 100, 200, 350, 500, 1000];

/** Normaliza texto quitando tildes/diacríticos y espacios extra para comparaciones seguras. */
export function normalizarTextoGeo(texto?: string | null): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Coordenadas de referencia (claves normalizadas sin tildes) por provincia y principales
 * localidades ganaderas de Argentina, más caché dinámica alimentada por API Georef.
 */
const COORDENADAS_REFERENCIA: Record<string, { lat: number; lon: number; label: string }> = {
  // Provincias
  "buenos aires": { lat: -36.6769, lon: -60.5588, label: "Buenos Aires" },
  "caba": { lat: -34.6037, lon: -58.3816, label: "CABA" },
  "capital federal": { lat: -34.6037, lon: -58.3816, label: "Capital Federal" },
  "cordoba": { lat: -31.4201, lon: -64.1888, label: "Córdoba" },
  "santa fe": { lat: -31.6333, lon: -60.7, label: "Santa Fe" },
  "entre rios": { lat: -31.732, lon: -60.5238, label: "Entre Ríos" },
  "la pampa": { lat: -36.6167, lon: -64.2833, label: "La Pampa" },
  "corrientes": { lat: -27.4692, lon: -58.8306, label: "Corrientes" },
  "san luis": { lat: -33.295, lon: -66.3356, label: "San Luis" },
  "chaco": { lat: -27.4514, lon: -58.9867, label: "Chaco" },
  "santiago del estero": { lat: -27.7951, lon: -64.2615, label: "Santiago del Estero" },
  "formosa": { lat: -26.1775, lon: -58.1781, label: "Formosa" },
  "salta": { lat: -24.7821, lon: -65.4232, label: "Salta" },
  "tucuman": { lat: -26.8083, lon: -65.2176, label: "Tucumán" },
  "misiones": { lat: -27.3671, lon: -55.8961, label: "Misiones" },
  "mendoza": { lat: -32.8895, lon: -68.8458, label: "Mendoza" },
  "san juan": { lat: -31.5375, lon: -68.5364, label: "San Juan" },
  "la rioja": { lat: -29.4131, lon: -66.8558, label: "La Rioja" },
  "catamarca": { lat: -28.4696, lon: -65.7852, label: "Catamarca" },
  "jujuy": { lat: -24.1858, lon: -65.2995, label: "Jujuy" },
  "rio negro": { lat: -40.8135, lon: -62.9967, label: "Río Negro" },
  "neuquen": { lat: -38.9516, lon: -68.0591, label: "Neuquén" },
  "chubut": { lat: -43.3002, lon: -65.1023, label: "Chubut" },
  "santa cruz": { lat: -51.6226, lon: -69.2181, label: "Santa Cruz" },
  "tierra del fuego": { lat: -54.8019, lon: -68.303, label: "Tierra del Fuego" },

  // Localidades de Santa Fe
  "huanqueros": { lat: -30.012, lon: -61.2185, label: "Huanqueros, Santa Fe" },
  "san cristobal": { lat: -30.3117, lon: -61.2362, label: "San Cristóbal, Santa Fe" },
  "ceres": { lat: -29.882, lon: -61.9464, label: "Ceres, Santa Fe" },
  "tostado": { lat: -29.2325, lon: -61.7692, label: "Tostado, Santa Fe" },
  "sunchales": { lat: -30.944, lon: -61.5615, label: "Sunchales, Santa Fe" },
  "san guillermo": { lat: -30.3589, lon: -61.9169, label: "San Guillermo, Santa Fe" },
  "suardi": { lat: -30.5364, lon: -61.9589, label: "Suardi, Santa Fe" },
  "arrufo": { lat: -30.2333, lon: -61.7167, label: "Arrufó, Santa Fe" },
  "hersilia": { lat: -30.0031, lon: -61.8492, label: "Hersilia, Santa Fe" },
  "rafaela": { lat: -31.2503, lon: -61.4867, label: "Rafaela, Santa Fe" },
  "esperanza": { lat: -31.4488, lon: -60.9317, label: "Esperanza, Santa Fe" },
  "san justo": { lat: -30.7891, lon: -60.5919, label: "San Justo, Santa Fe" },
  "gobernador crespo": { lat: -30.3636, lon: -60.4008, label: "Gobernador Crespo, Santa Fe" },
  "calchaqui": { lat: -29.8886, lon: -60.2869, label: "Calchaquí, Santa Fe" },
  "vera": { lat: -29.4593, lon: -60.2126, label: "Vera, Santa Fe" },
  "reconquista": { lat: -29.1433, lon: -59.6438, label: "Reconquista, Santa Fe" },
  "avellaneda": { lat: -29.1176, lon: -59.6583, label: "Avellaneda, Santa Fe" },
  "venado tuerto": { lat: -33.7456, lon: -61.9688, label: "Venado Tuerto, Santa Fe" },
  "rufino": { lat: -34.2683, lon: -62.7126, label: "Rufino, Santa Fe" },
  "firmat": { lat: -33.4594, lon: -61.4832, label: "Firmat, Santa Fe" },
  "casilda": { lat: -33.0442, lon: -61.1681, label: "Casilda, Santa Fe" },
  "rosario": { lat: -32.9442, lon: -60.6505, label: "Rosario, Santa Fe" },
  "san jorge": { lat: -31.8962, lon: -61.8598, label: "San Jorge, Santa Fe" },
  "el trebol": { lat: -32.1998, lon: -61.7014, label: "El Trébol, Santa Fe" },
  "las rosas": { lat: -32.4766, lon: -61.5804, label: "Las Rosas, Santa Fe" },

  // Localidades de Córdoba
  "rio cuarto": { lat: -33.1307, lon: -64.3499, label: "Río Cuarto, Córdoba" },
  "villa maria": { lat: -32.4075, lon: -63.2402, label: "Villa María, Córdoba" },
  "bell ville": { lat: -32.6259, lon: -62.6887, label: "Bell Ville, Córdoba" },
  "marcos juarez": { lat: -32.6978, lon: -62.1067, label: "Marcos Juárez, Córdoba" },
  "jesus maria": { lat: -30.9815, lon: -64.0942, label: "Jesús María, Córdoba" },
  "san francisco": { lat: -31.428, lon: -62.0827, label: "San Francisco, Córdoba" },
  "morteros": { lat: -30.7116, lon: -61.9986, label: "Morteros, Córdoba" },
  "brinkmann": { lat: -30.8669, lon: -62.0369, label: "Brinkmann, Córdoba" },
  "laboulaye": { lat: -34.1266, lon: -63.3913, label: "Laboulaye, Córdoba" },
  "huinca renanco": { lat: -34.8394, lon: -64.3747, label: "Huinca Renancó, Córdoba" },
  "rio tercero": { lat: -32.173, lon: -64.1141, label: "Río Tercero, Córdoba" },
  "vicuna mackenna": { lat: -33.9167, lon: -64.3833, label: "Vicuña Mackenna, Córdoba" },

  // Localidades de Buenos Aires
  "tandil": { lat: -37.3217, lon: -59.1332, label: "Tandil, Buenos Aires" },
  "azul": { lat: -36.777, lon: -59.8585, label: "Azul, Buenos Aires" },
  "olavarria": { lat: -36.8927, lon: -60.3225, label: "Olavarría, Buenos Aires" },
  "trenque lauquen": { lat: -35.9704, lon: -62.7312, label: "Trenque Lauquen, Buenos Aires" },
  "lincoln": { lat: -34.8685, lon: -61.5291, label: "Lincoln, Buenos Aires" },
  "bolivar": { lat: -36.2333, lon: -61.1167, label: "Bolívar, Buenos Aires" },
  "pehuajo": { lat: -35.811, lon: -61.8988, label: "Pehuajó, Buenos Aires" },
  "9 de julio": { lat: -35.4444, lon: -60.8831, label: "9 de Julio, Buenos Aires" },
  "junin": { lat: -34.585, lon: -60.9589, label: "Junín, Buenos Aires" },
  "pergamino": { lat: -33.8899, lon: -60.5736, label: "Pergamino, Buenos Aires" },
  "chivilcoy": { lat: -34.8957, lon: -60.0167, label: "Chivilcoy, Buenos Aires" },
  "chascomus": { lat: -35.5786, lon: -58.009, label: "Chascomús, Buenos Aires" },
  "ayacucho": { lat: -37.1526, lon: -58.4882, label: "Ayacucho, Buenos Aires" },
  "rauch": { lat: -36.7745, lon: -59.0867, label: "Rauch, Buenos Aires" },
  "las flores": { lat: -36.014, lon: -59.0998, label: "Las Flores, Buenos Aires" },
  "saladillo": { lat: -35.6371, lon: -59.7779, label: "Saladillo, Buenos Aires" },
  "general villegas": { lat: -35.0328, lon: -63.0125, label: "General Villegas, Buenos Aires" },
  "bahia blanca": { lat: -38.7183, lon: -62.2663, label: "Bahía Blanca, Buenos Aires" },
  "coronel suarez": { lat: -37.4547, lon: -61.9334, label: "Coronel Suárez, Buenos Aires" },
  "tres arroyos": { lat: -38.3739, lon: -60.2798, label: "Tres Arroyos, Buenos Aires" },
  "balcarce": { lat: -37.8462, lon: -58.2552, label: "Balcarce, Buenos Aires" },
  "necochea": { lat: -38.5545, lon: -58.7396, label: "Necochea, Buenos Aires" },

  // Entre Ríos, Corrientes, La Pampa, San Luis, Chaco
  "santa rosa": { lat: -36.6167, lon: -64.2833, label: "Santa Rosa, La Pampa" },
  "general pico": { lat: -35.6566, lon: -63.7568, label: "General Pico, La Pampa" },
  "victorica": { lat: -36.2152, lon: -65.4359, label: "Victorica, La Pampa" },
  "general acha": { lat: -37.377, lon: -64.6043, label: "General Acha, La Pampa" },
  "gualeguaychu": { lat: -33.0094, lon: -58.5172, label: "Gualeguaychú, Entre Ríos" },
  "gualeguay": { lat: -33.1416, lon: -59.3097, label: "Gualeguay, Entre Ríos" },
  "villaguay": { lat: -31.8653, lon: -59.0269, label: "Villaguay, Entre Ríos" },
  "parana": { lat: -31.732, lon: -60.5238, label: "Paraná, Entre Ríos" },
  "concordia": { lat: -31.393, lon: -58.0209, label: "Concordia, Entre Ríos" },
  "la paz": { lat: -30.7418, lon: -59.6452, label: "La Paz, Entre Ríos" },
  "victoria": { lat: -32.6185, lon: -60.1548, label: "Victoria, Entre Ríos" },
  "mercedes": { lat: -29.1842, lon: -58.0753, label: "Mercedes, Corrientes" },
  "curuzu cuatia": { lat: -29.7917, lon: -58.0546, label: "Curuzú Cuatiá, Corrientes" },
  "goya": { lat: -29.14, lon: -59.2626, label: "Goya, Corrientes" },
  "esquina": { lat: -30.0144, lon: -59.5273, label: "Esquina, Corrientes" },
  "villa mercedes": { lat: -33.6757, lon: -65.4578, label: "Villa Mercedes, San Luis" },
  "resistencia": { lat: -27.4514, lon: -58.9867, label: "Resistencia, Chaco" },
  "saenz pena": { lat: -26.7852, lon: -60.4388, label: "Presidencia Roque Sáenz Peña, Chaco" },
  "villa angela": { lat: -27.5738, lon: -60.7153, label: "Villa Ángela, Chaco" },
  "charata": { lat: -27.2144, lon: -61.1879, label: "Charata, Chaco" },
};

/** Caché en memoria de localidades resueltas vía API Georef Argentina */
const CACHE_GEOREF_MEMORIA: Record<string, Punto> = {};

function claveCacheGeo(localidad?: string | null, provincia?: string | null): string {
  return `${normalizarTextoGeo(localidad)}|${normalizarTextoGeo(provincia)}`;
}

/**
 * Resuelve coordenadas de una oferta o ubicación usando:
 * 1) Geometría PostGIS (`ubicacion` WKB hex)
 * 2) Caché dinámica Georef (`localidad|provincia`)
 * 3) Diccionario local por `localidad` normalizada
 * 4) Diccionario local por `provincia` normalizada
 */
export function resolverCoordenadas(
  ubicacionHex?: string | null,
  localidad?: string | null,
  provincia?: string | null
): Punto | null {
  const geo = decodeGeografia(ubicacionHex);
  if (geo) return geo;

  const clave = claveCacheGeo(localidad, provincia);
  if (CACHE_GEOREF_MEMORIA[clave]) {
    return CACHE_GEOREF_MEMORIA[clave];
  }

  const locLimpia = normalizarTextoGeo(localidad);
  if (locLimpia && COORDENADAS_REFERENCIA[locLimpia]) {
    const p = COORDENADAS_REFERENCIA[locLimpia];
    return { lat: p.lat, lon: p.lon };
  }

  // Si el usuario escribió "Localidad, Provincia" todo junto en un texto:
  if (locLimpia.includes(",")) {
    const [parteLoc, parteProv] = locLimpia.split(",").map((s) => s.trim());
    const claveCompuesta = claveCacheGeo(parteLoc, parteProv);
    if (CACHE_GEOREF_MEMORIA[claveCompuesta]) {
      return CACHE_GEOREF_MEMORIA[claveCompuesta];
    }
    if (parteLoc && COORDENADAS_REFERENCIA[parteLoc]) {
      const p = COORDENADAS_REFERENCIA[parteLoc];
      return { lat: p.lat, lon: p.lon };
    }
    if (parteProv && COORDENADAS_REFERENCIA[parteProv]) {
      const p = COORDENADAS_REFERENCIA[parteProv];
      return { lat: p.lat, lon: p.lon };
    }
  }

  const provLimpia = normalizarTextoGeo(provincia);
  if (provLimpia && COORDENADAS_REFERENCIA[provLimpia]) {
    const p = COORDENADAS_REFERENCIA[provLimpia];
    return { lat: p.lat, lon: p.lon };
  }

  for (const [k, punto] of Object.entries(COORDENADAS_REFERENCIA)) {
    if ((locLimpia && locLimpia === k) || (provLimpia && provLimpia === k)) {
      return { lat: punto.lat, lon: punto.lon };
    }
  }

  return null;
}

export type SugerenciaUbicacion = {
  id: string;
  label: string;
  localidad: string;
  provincia: string;
  coords: Punto;
};

/** Consulta la API oficial Georef Argentina para obtener coordenadas exactas de cualquier localidad. */
async function buscarLocalidadesGeoref(texto: string): Promise<SugerenciaUbicacion[]> {
  const limpio = texto.trim();
  if (limpio.length < 2) return [];

  const partes = limpio.split(",").map((s) => s.trim()).filter(Boolean);
  const nombreLoc = partes[0] ?? limpio;
  const nombreProv = partes[1] ?? "";

  try {
    const params = new URLSearchParams({
      nombre: nombreLoc,
      max: "6",
      campos: "id,nombre,provincia.nombre,centroide.lat,centroide.lon",
    });
    if (nombreProv) {
      params.set("provincia", nombreProv);
    }

    const res = await fetch(`https://apis.datos.gob.ar/georef/api/localidades?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const lista = Array.isArray(data?.localidades) ? data.localidades : [];

    const resultados: SugerenciaUbicacion[] = [];
    const vistos = new Set<string>();

    for (const item of lista) {
      const lat = Number(item?.centroide?.lat);
      const lon = Number(item?.centroide?.lon);
      const locNombre = String(item?.nombre ?? "").trim();
      const provNombre = String(item?.provincia?.nombre ?? "").trim();
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !locNombre) continue;

      const label = provNombre ? `${locNombre}, ${provNombre}` : locNombre;
      const key = normalizarTextoGeo(label);
      if (vistos.has(key)) continue;
      vistos.add(key);

      const coords = { lat, lon };
      CACHE_GEOREF_MEMORIA[claveCacheGeo(locNombre, provNombre)] = coords;
      CACHE_GEOREF_MEMORIA[claveCacheGeo(label, "")] = coords;

      resultados.push({
        id: String(item.id ?? key),
        label,
        localidad: locNombre,
        provincia: provNombre,
        coords,
      });
    }

    return resultados;
  } catch {
    return [];
  }
}

export type FiltrosOfertaState = {
  categoria: string;
  precioMin: string;
  precioMax: string;
  radioKm: string;
  ubicacionTexto: string;
  ubicacionConfirmada: string;
  ubicacionCoords: Punto | null;
};

export const FILTROS_OFERTA_INICIAL: FiltrosOfertaState = {
  categoria: "",
  precioMin: "",
  precioMax: "",
  radioKm: "",
  ubicacionTexto: "",
  ubicacionConfirmada: "",
  ubicacionCoords: null,
};

function coincideCategoria(catOfertaRaw?: string | null, catFiltroRaw?: string | null): boolean {
  const catFiltro = normalizarTextoGeo(catFiltroRaw);
  if (!catFiltro) return true;
  const catOferta = normalizarTextoGeo(catOfertaRaw);
  if (catOferta === catFiltro) return true;
  // Si filtra por "Novillos" también contempla "Novillitos" si no eligió explícitamente otro
  if (catFiltro === "novillos" && (catOferta === "novillos" || catOferta === "novillitos")) {
    return true;
  }
  return false;
}

export function filtrarOfertas(
  ofertas: OfertaResumen[],
  filtros: FiltrosOfertaState,
  _origenUsuario?: { localidad?: string | null; provincia?: string | null } | null
): OfertaResumen[] {
  const precioMinStr = (filtros.precioMin ?? "").trim();
  const precioMaxStr = (filtros.precioMax ?? "").trim();
  const precioMinNum = precioMinStr ? Number(precioMinStr.replace(/[^0-9.]/g, "")) : null;
  const precioMaxNum = precioMaxStr ? Number(precioMaxStr.replace(/[^0-9.]/g, "")) : null;
  const radioKmNum = filtros.radioKm.trim() ? Number(filtros.radioKm.replace(/[^0-9.]/g, "")) : null;

  // Coordenadas declaradas por el buscador en el filtro de radio
  const puntoOrigen: Punto | null =
    filtros.ubicacionCoords ??
    (filtros.ubicacionTexto.trim()
      ? resolverCoordenadas(null, filtros.ubicacionTexto, null)
      : null);

  return ofertas.filter((oferta) => {
    // 1. Categoría de animales
    if (filtros.categoria && !coincideCategoria(oferta.categoria, filtros.categoria)) {
      return false;
    }

    // 2. Rango de precio (Entre precioMin y precioMax)
    const precioOferta = Number(oferta.precio ?? 0);
    if (precioMinNum != null && !Number.isNaN(precioMinNum) && precioMinNum > 0) {
      if (precioOferta < precioMinNum) {
        return false;
      }
    }
    if (precioMaxNum != null && !Number.isNaN(precioMaxNum) && precioMaxNum > 0) {
      if (precioOferta > precioMaxNum) {
        return false;
      }
    }

    // 3. Radio (km) — requiere que el buscador haya declarado su ubicación
    if (radioKmNum != null && !Number.isNaN(radioKmNum) && radioKmNum > 0) {
      // Si el usuario aún no declaró su ubicación, no podemos validar el radio todavía
      if (!puntoOrigen) {
        return false;
      }

      const puntoOferta = resolverCoordenadas(
        (oferta as any).ubicacion,
        oferta.localidad,
        oferta.provincia
      );

      if (!puntoOferta) {
        return false;
      }

      const km = distanciaKm(puntoOrigen, puntoOferta);
      if (km > radioKmNum) {
        return false;
      }
    }

    return true;
  });
}

export function OfertasFilterBar({
  filtros,
  onChange,
  totalResultados,
  totalSinFiltrar,
  ofertas,
}: {
  filtros: FiltrosOfertaState;
  onChange: (next: FiltrosOfertaState) => void;
  totalResultados: number;
  totalSinFiltrar: number;
  ofertas?: OfertaResumen[];
}) {
  const [sugerencias, setSugerencias] = useState<SugerenciaUbicacion[]>([]);
  const [buscandoGeo, setBuscandoGeo] = useState(false);
  const [obteniendoGps, setObteniendoGps] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;

  // Geocodificar automáticamente las localidades de las ofertas activas que no estén en el diccionario
  useEffect(() => {
    if (!ofertas || ofertas.length === 0) return;
    let cancelado = false;

    const geocodificarOfertasPendientes = async () => {
      let huboNuevasCoords = false;
      for (const ofr of ofertas) {
        const yaTiene = resolverCoordenadas((ofr as any).ubicacion, ofr.localidad, ofr.provincia);
        if (yaTiene && ofr.localidad && COORDENADAS_REFERENCIA[normalizarTextoGeo(ofr.localidad)]) {
          continue;
        }
        const clave = claveCacheGeo(ofr.localidad, ofr.provincia);
        if (CACHE_GEOREF_MEMORIA[clave]) continue;

        if (ofr.localidad) {
          const query = [ofr.localidad.trim(), (ofr.provincia ?? "").trim()]
            .filter(Boolean)
            .join(", ");
          const res = await buscarLocalidadesGeoref(query);
          if (res.length > 0) {
            CACHE_GEOREF_MEMORIA[clave] = res[0].coords;
            huboNuevasCoords = true;
          }
        }
      }

      if (!cancelado && huboNuevasCoords && filtrosRef.current.radioKm.trim()) {
        onChange({ ...filtrosRef.current });
      }
    };

    void geocodificarOfertasPendientes();
    return () => {
      cancelado = true;
    };
  }, [ofertas, onChange]);

  // Autocompletado y geocodificación en vivo cuando el buscador escribe su ubicación
  useEffect(() => {
    const texto = (filtros.ubicacionTexto ?? "").trim();
    if (texto.length < 2) {
      setSugerencias([]);
      setBuscandoGeo(false);
      return;
    }

    // Si ya coincide con la ubicación confirmada, no volver a abrir el menú
    if (filtros.ubicacionConfirmada && texto === filtros.ubicacionConfirmada && filtros.ubicacionCoords) {
      return;
    }

    let cancelado = false;
    setBuscandoGeo(true);

    const timer = setTimeout(async () => {
      // 1. Buscar coincidencias rápidas en diccionario local
      const norm = normalizarTextoGeo(texto);
      const locales: SugerenciaUbicacion[] = [];
      for (const [k, val] of Object.entries(COORDENADAS_REFERENCIA)) {
        if (k.includes(norm) || normalizarTextoGeo(val.label).includes(norm)) {
          locales.push({
            id: `local-${k}`,
            label: val.label,
            localidad: val.label.split(",")[0].trim(),
            provincia: val.label.split(",")[1]?.trim() ?? "",
            coords: { lat: val.lat, lon: val.lon },
          });
          if (locales.length >= 4) break;
        }
      }

      // 2. Consultar API Georef Argentina para cualquier localidad del país
      const remotas = await buscarLocalidadesGeoref(texto);
      if (cancelado) return;

      const combinadas: SugerenciaUbicacion[] = [...remotas];
      for (const loc of locales) {
        if (
          !combinadas.some(
            (r) => normalizarTextoGeo(r.label) === normalizarTextoGeo(loc.label)
          )
        ) {
          combinadas.push(loc);
        }
      }

      setSugerencias(combinadas.slice(0, 6));
      setBuscandoGeo(false);

      // Si el usuario escribió un nombre que tiene match claro y aún no fijó coords, resolverlo automáticamente
      if (combinadas.length > 0) {
        const mejor = combinadas[0];
        const actual = filtrosRef.current;
        if (
          !actual.ubicacionCoords ||
          actual.ubicacionCoords.lat !== mejor.coords.lat ||
          actual.ubicacionCoords.lon !== mejor.coords.lon
        ) {
          onChange({
            ...actual,
            ubicacionCoords: mejor.coords,
            ubicacionConfirmada: mejor.label,
          });
        }
      }
    }, 280);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [filtros.ubicacionTexto, filtros.ubicacionConfirmada, filtros.ubicacionCoords, onChange]);

  const seleccionarSugerencia = (sug: SugerenciaUbicacion) => {
    setErrorUbicacion(null);
    setMostrarSugerencias(false);
    setSugerencias([]);
    onChange({
      ...filtros,
      ubicacionTexto: sug.label,
      ubicacionConfirmada: sug.label,
      ubicacionCoords: sug.coords,
    });
  };

  const usarUbicacionGps = () => {
    setErrorUbicacion(null);
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
      setObteniendoGps(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords: Punto = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          };
          let etiqueta = `Mi ubicación GPS (${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)})`;
          try {
            const r = await fetch(
              `https://apis.datos.gob.ar/georef/api/ubicacion?lat=${coords.lat}&lon=${coords.lon}`
            );
            if (r.ok) {
              const d = await r.json();
              const mun = d?.ubicacion?.municipio?.nombre || d?.ubicacion?.departamento?.nombre;
              const prov = d?.ubicacion?.provincia?.nombre;
              if (mun && prov) {
                etiqueta = `${mun}, ${prov} (GPS)`;
              } else if (prov) {
                etiqueta = `${prov} (GPS)`;
              }
            }
          } catch {
            // conservar etiqueta con coordenadas
          }
          setObteniendoGps(false);
          setMostrarSugerencias(false);
          onChange({
            ...filtrosRef.current,
            ubicacionTexto: etiqueta,
            ubicacionConfirmada: etiqueta,
            ubicacionCoords: coords,
          });
        },
        () => {
          setObteniendoGps(false);
          setErrorUbicacion(
            "No pudimos acceder al GPS del navegador. Escribí tu localidad o provincia manualmente."
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setErrorUbicacion("Tu navegador no permite geolocalización automática. Escribí tu localidad.");
    }
  };

  const hayFiltrosActivos = Boolean(
    filtros.categoria ||
      (filtros.precioMin ?? "").trim() ||
      (filtros.precioMax ?? "").trim() ||
      filtros.radioKm.trim() ||
      (filtros.ubicacionTexto ?? "").trim()
  );

  const radioActivoSinUbicacion =
    Boolean(filtros.radioKm.trim()) &&
    !filtros.ubicacionCoords &&
    !(filtros.ubicacionTexto ?? "").trim();

  const limpiar = () => {
    setErrorUbicacion(null);
    setSugerencias([]);
    setMostrarSugerencias(false);
    onChange(FILTROS_OFERTA_INICIAL);
  };

  return (
    <Card className="gap-3.5 border border-line-soft bg-surface p-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-sage-50">
            <Icon name="search" size={16} className="text-sage-700" />
          </View>
          <View>
            <Text className="text-sm font-extrabold text-ink">Filtrar ofertas</Text>
            <Text className="text-[11px] text-ink-muted">
              Buscá lotes por categoría de animales, rango de precio y radio de distancia (km)
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <Badge tone={hayFiltrosActivos ? "sage" : "neutral"}>
            {`${totalResultados} de ${totalSinFiltrar} lotes`}
          </Badge>
          {hayFiltrosActivos ? (
            <Pressable
              onPress={limpiar}
              accessibilityRole="button"
              className="flex-row items-center gap-1 rounded-xl border border-line bg-surface-soft px-2.5 py-1.5 active:bg-surface-sunk cursor-pointer"
            >
              <Icon name="x" size={13} className="text-ink-soft" />
              <Text className="text-xs font-bold text-ink-soft">Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 1. Categoría de animales */}
      <View className="gap-1.5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          Categoría de animales
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          <Pressable
            onPress={() => onChange({ ...filtros, categoria: "" })}
            className={[
              "rounded-xl border px-3 py-1.5 cursor-pointer",
              filtros.categoria === ""
                ? "border-sage-600 bg-sage-600"
                : "border-line bg-surface-soft active:bg-surface-sunk",
            ].join(" ")}
          >
            <Text
              className={[
                "text-xs font-bold",
                filtros.categoria === "" ? "text-white" : "text-ink-soft",
              ].join(" ")}
            >
              Todas
            </Text>
          </Pressable>

          {CATEGORIAS_ANIMALES.map((cat) => {
            const activa = filtros.categoria === cat;
            return (
              <Pressable
                key={cat}
                onPress={() =>
                  onChange({ ...filtros, categoria: activa ? "" : cat })
                }
                className={[
                  "rounded-xl border px-3 py-1.5 cursor-pointer",
                  activa
                    ? "border-sage-600 bg-sage-600"
                    : "border-line bg-surface-soft active:bg-surface-sunk",
                ].join(" ")}
              >
                <Text
                  className={[
                    "text-xs font-bold",
                    activa ? "text-white" : "text-ink-soft",
                  ].join(" ")}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 2. Rango de Precio (Entre ... y ...) y 3. Radio (km) con Ubicación del buscador */}
      <View className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Filtro Precio (Rango con 2 inputs: Entre ... y ...) */}
        <View className="gap-1.5">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Precio (Rango: Entre $ y $)
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-line bg-surface-soft px-3 py-2">
              <Text className="text-xs font-bold text-ink-muted">Entre $</Text>
              <TextInput
                value={filtros.precioMin}
                onChangeText={(t) =>
                  onChange({ ...filtros, precioMin: t.replace(/[^0-9]/g, "") })
                }
                placeholder="Mínimo"
                placeholderTextColor="#8C978E"
                keyboardType="numeric"
                className="min-w-0 flex-1 text-xs font-semibold text-ink outline-none"
              />
              {filtros.precioMin ? (
                <Pressable onPress={() => onChange({ ...filtros, precioMin: "" })}>
                  <Icon name="x" size={14} className="text-ink-muted" />
                </Pressable>
              ) : null}
            </View>

            <Text className="text-xs font-bold text-ink-muted">y</Text>

            <View className="flex-1 flex-row items-center gap-1.5 rounded-xl border border-line bg-surface-soft px-3 py-2">
              <Text className="text-xs font-bold text-ink-muted">$</Text>
              <TextInput
                value={filtros.precioMax}
                onChangeText={(t) =>
                  onChange({ ...filtros, precioMax: t.replace(/[^0-9]/g, "") })
                }
                placeholder="Máximo"
                placeholderTextColor="#8C978E"
                keyboardType="numeric"
                className="min-w-0 flex-1 text-xs font-semibold text-ink outline-none"
              />
              {filtros.precioMax ? (
                <Pressable onPress={() => onChange({ ...filtros, precioMax: "" })}>
                  <Icon name="x" size={14} className="text-ink-muted" />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Filtro Radio (km) + Declaración de ubicación del buscador */}
        <View className="gap-2 rounded-2xl border border-line-soft bg-surface-soft/50 p-3">
          <View className="flex-row flex-wrap items-center justify-between gap-1">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Radio de búsqueda (km) y tu ubicación
            </Text>
            {filtros.ubicacionCoords && filtros.ubicacionConfirmada ? (
              <View className="flex-row items-center gap-1 rounded-lg bg-sage-50 border border-sage-200 px-2 py-0.5">
                <Icon name="mapPin" size={11} className="text-sage-700" />
                <Text className="text-[10px] font-bold text-sage-800">
                  Desde: {filtros.ubicacionConfirmada}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Paso 1: Declarar ubicación del buscador */}
          <View className="gap-1.5">
            <View className="flex-row items-center gap-2">
              <View
                className={[
                  "flex-1 flex-row items-center gap-2 rounded-xl border bg-surface px-3 py-2",
                  radioActivoSinUbicacion ? "border-amber-500" : "border-line",
                ].join(" ")}
              >
                <Icon
                  name="mapPin"
                  size={15}
                  className={
                    filtros.ubicacionCoords ? "text-sage-600" : "text-clay-600"
                  }
                />
                <TextInput
                  value={filtros.ubicacionTexto}
                  onFocus={() => setMostrarSugerencias(true)}
                  onChangeText={(t) => {
                    setErrorUbicacion(null);
                    setMostrarSugerencias(true);
                    const coordsDirectas = t.trim()
                      ? resolverCoordenadas(null, t, null)
                      : null;
                    onChange({
                      ...filtros,
                      ubicacionTexto: t,
                      ubicacionConfirmada: coordsDirectas ? t.trim() : "",
                      ubicacionCoords: coordsDirectas,
                    });
                  }}
                  placeholder="1º Declará tu localidad o provincia (ej: Huanqueros, Río Cuarto...)"
                  placeholderTextColor="#8C978E"
                  className="min-w-0 flex-1 text-xs font-semibold text-ink outline-none"
                />
                {buscandoGeo ? (
                  <ActivityIndicator size="small" className="text-sage-600" />
                ) : null}
                {filtros.ubicacionTexto ? (
                  <Pressable
                    onPress={() => {
                      setSugerencias([]);
                      setMostrarSugerencias(false);
                      onChange({
                        ...filtros,
                        ubicacionTexto: "",
                        ubicacionConfirmada: "",
                        ubicacionCoords: null,
                      });
                    }}
                  >
                    <Icon name="x" size={14} className="text-ink-muted" />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={usarUbicacionGps}
                disabled={obteniendoGps}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 rounded-xl border border-sage-600 bg-sage-50 px-3 py-2 active:bg-sage-100 cursor-pointer"
              >
                {obteniendoGps ? (
                  <ActivityIndicator size="small" className="text-sage-700" />
                ) : (
                  <Icon name="mapPin" size={14} className="text-sage-700" />
                )}
                <Text className="text-xs font-extrabold text-sage-800">
                  Mi GPS
                </Text>
              </Pressable>
            </View>

            {/* Sugerencias de localidades de Argentina (API Georef + Diccionario) */}
            {mostrarSugerencias && sugerencias.length > 0 ? (
              <View className="rounded-xl border border-line bg-surface p-1.5 shadow-sm gap-1">
                <Text className="px-2 py-0.5 text-[10px] font-bold uppercase text-ink-muted">
                  Seleccioná tu localidad exacta:
                </Text>
                {sugerencias.map((sug) => (
                  <Pressable
                    key={sug.id}
                    onPress={() => seleccionarSugerencia(sug)}
                    className="flex-row items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-sage-50 active:bg-sage-100 cursor-pointer"
                  >
                    <View className="flex-row items-center gap-2">
                      <Icon name="mapPin" size={13} className="text-sage-700" />
                      <Text className="text-xs font-bold text-ink">{sug.label}</Text>
                    </View>
                    <Text className="text-[10px] font-semibold text-sage-700">
                      Elegir
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {errorUbicacion ? (
              <Text className="text-[11px] font-semibold text-clay-700">
                {errorUbicacion}
              </Text>
            ) : null}

            {radioActivoSinUbicacion ? (
              <View className="flex-row items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                <Icon name="alert" size={14} className="text-amber-700" />
                <Text className="flex-1 text-[11px] font-bold text-amber-900">
                  Declará tu ubicación arriba (escribí tu localidad/provincia o tocá &quot;Mi GPS&quot;) para buscar lotes en un radio de {filtros.radioKm} km.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Paso 2: Indicar o elegir el radio en km */}
          <View className="flex-row items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
            <Icon name="ruler" size={15} className="text-clay-600" />
            <TextInput
              value={filtros.radioKm}
              onChangeText={(t) =>
                onChange({ ...filtros, radioKm: t.replace(/[^0-9]/g, "") })
              }
              placeholder="2º Radio en km (ej: 100 km)"
              placeholderTextColor="#8C978E"
              keyboardType="numeric"
              className="flex-1 text-xs font-semibold text-ink outline-none"
            />
            {filtros.radioKm ? (
              <Pressable onPress={() => onChange({ ...filtros, radioKm: "" })}>
                <Icon name="x" size={14} className="text-ink-muted" />
              </Pressable>
            ) : null}
          </View>

          <View className="flex-row flex-wrap gap-1.5 pt-0.5">
            {RADIOS_KM_OPCIONES.map((km) => {
              const activo = filtros.radioKm === String(km);
              return (
                <Pressable
                  key={km}
                  onPress={() =>
                    onChange({
                      ...filtros,
                      radioKm: activo ? "" : String(km),
                    })
                  }
                  className={[
                    "rounded-lg border px-2 py-1 cursor-pointer",
                    activo
                      ? "border-clay-500 bg-clay-500"
                      : "border-line-soft bg-surface",
                  ].join(" ")}
                >
                  <Text
                    className={[
                      "text-[11px] font-bold",
                      activo ? "text-white" : "text-ink-muted",
                    ].join(" ")}
                  >
                    {km} km
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Card>
  );
}
