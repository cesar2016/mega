import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "components/ui/Icon";
import { Badge, Card } from "components/ui/Card";
import { decodeGeografia, distanciaKm } from "lib/matching";
import type { Punto } from "lib/matching";
import type { OfertaResumen } from "features/offers/OfferCard";

export const CATEGORIAS_ANIMALES = [
  "Novillos",
  "Vaquillonas",
  "Terneros",
  "Vacas",
  "Toros",
  "Conserva",
  "Variados",
];

export const RADIOS_KM_OPCIONES = [50, 100, 200, 350, 500, 1000];

/**
 * Coordenadas de referencia por provincia y principales localidades ganaderas de Argentina
 * para calcular el radio en km incluso cuando la oferta no tenga geometría PostGIS cargada.
 */
const COORDENADAS_REFERENCIA: Record<string, Punto> = {
  "buenos aires": { lat: -36.6769, lon: -60.5588 },
  "caba": { lat: -34.6037, lon: -58.3816 },
  "capital federal": { lat: -34.6037, lon: -58.3816 },
  "cordoba": { lat: -31.4201, lon: -64.1888 },
  "córdoba": { lat: -31.4201, lon: -64.1888 },
  "santa fe": { lat: -31.6333, lon: -60.7 },
  "entre rios": { lat: -31.732, lon: -60.5238 },
  "entre ríos": { lat: -31.732, lon: -60.5238 },
  "la pampa": { lat: -36.6167, lon: -64.2833 },
  "corrientes": { lat: -27.4692, lon: -58.8306 },
  "san luis": { lat: -33.295, lon: -66.3356 },
  "chaco": { lat: -27.4514, lon: -58.9867 },
  "santiago del estero": { lat: -27.7951, lon: -64.2615 },
  "formosa": { lat: -26.1775, lon: -58.1781 },
  "salta": { lat: -24.7821, lon: -65.4232 },
  "tucuman": { lat: -26.8083, lon: -65.2176 },
  "tucumán": { lat: -26.8083, lon: -65.2176 },
  "misiones": { lat: -27.3671, lon: -55.8961 },
  "mendoza": { lat: -32.8895, lon: -68.8458 },
  "san juan": { lat: -31.5375, lon: -68.5364 },
  "la rioja": { lat: -29.4131, lon: -66.8558 },
  "catamarca": { lat: -28.4696, lon: -65.7852 },
  "jujuy": { lat: -24.1858, lon: -65.2995 },
  "rio negro": { lat: -40.8135, lon: -62.9967 },
  "río negro": { lat: -40.8135, lon: -62.9967 },
  "neuquen": { lat: -38.9516, lon: -68.0591 },
  "neuquén": { lat: -38.9516, lon: -68.0591 },
  "chubut": { lat: -43.3002, lon: -65.1023 },
  "santa cruz": { lat: -51.6226, lon: -69.2181 },
  "tierra del fuego": { lat: -54.8019, lon: -68.303 },
  // Localidades frecuentes
  "tandil": { lat: -37.3217, lon: -59.1332 },
  "azul": { lat: -36.777, lon: -59.8585 },
  "olavarria": { lat: -36.8927, lon: -60.3225 },
  "olavarría": { lat: -36.8927, lon: -60.3225 },
  "trenque lauquen": { lat: -35.9704, lon: -62.7312 },
  "lincoln": { lat: -34.8685, lon: -61.5291 },
  "bolivar": { lat: -36.2333, lon: -61.1167 },
  "bolívar": { lat: -36.2333, lon: -61.1167 },
  "rio cuarto": { lat: -33.1307, lon: -64.3499 },
  "río cuarto": { lat: -33.1307, lon: -64.3499 },
  "venado tuerto": { lat: -33.7456, lon: -61.9688 },
  "rafaela": { lat: -31.2503, lon: -61.4867 },
  "santa rosa": { lat: -36.6167, lon: -64.2833 },
  "general pico": { lat: -35.6566, lon: -63.7568 },
  "gualeguaychu": { lat: -33.0094, lon: -58.5172 },
  "gualeguaychú": { lat: -33.0094, lon: -58.5172 },
  "mercedes": { lat: -29.1842, lon: -58.0753 },
  "curuzu cuatia": { lat: -29.7917, lon: -58.0546 },
  "curuzú cuatiá": { lat: -29.7917, lon: -58.0546 },
  "villa mercedes": { lat: -33.6757, lon: -65.4578 },
};

export function resolverCoordenadas(
  ubicacionHex?: string | null,
  localidad?: string | null,
  provincia?: string | null
): Punto | null {
  const geo = decodeGeografia(ubicacionHex);
  if (geo) return geo;

  const locLimpia = (localidad ?? "").trim().toLowerCase();
  if (locLimpia && COORDENADAS_REFERENCIA[locLimpia]) {
    return COORDENADAS_REFERENCIA[locLimpia];
  }

  const provLimpia = (provincia ?? "").trim().toLowerCase();
  if (provLimpia && COORDENADAS_REFERENCIA[provLimpia]) {
    return COORDENADAS_REFERENCIA[provLimpia];
  }

  for (const [clave, punto] of Object.entries(COORDENADAS_REFERENCIA)) {
    if ((locLimpia && locLimpia.includes(clave)) || (provLimpia && provLimpia.includes(clave))) {
      return punto;
    }
  }

  return null;
}

export type FiltrosOfertaState = {
  categoria: string;
  precioMin: string;
  precioMax: string;
  radioKm: string;
};

export const FILTROS_OFERTA_INICIAL: FiltrosOfertaState = {
  categoria: "",
  precioMin: "",
  precioMax: "",
  radioKm: "",
};

export function filtrarOfertas(
  ofertas: OfertaResumen[],
  filtros: FiltrosOfertaState,
  origenUsuario?: { localidad?: string | null; provincia?: string | null } | null
): OfertaResumen[] {
  const catFiltro = filtros.categoria.trim().toLowerCase();
  const precioMinStr = (filtros.precioMin ?? "").trim();
  const precioMaxStr = (filtros.precioMax ?? "").trim();
  const precioMinNum = precioMinStr ? Number(precioMinStr.replace(/[^0-9.]/g, "")) : null;
  const precioMaxNum = precioMaxStr ? Number(precioMaxStr.replace(/[^0-9.]/g, "")) : null;
  const radioKmNum = filtros.radioKm.trim() ? Number(filtros.radioKm.replace(/[^0-9.]/g, "")) : null;

  const puntoOrigen =
    resolverCoordenadas(null, origenUsuario?.localidad, origenUsuario?.provincia) ??
    COORDENADAS_REFERENCIA["buenos aires"];

  return ofertas.filter((oferta) => {
    // 1. Categoría de animales
    if (catFiltro && (oferta.categoria ?? "").trim().toLowerCase() !== catFiltro) {
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

    // 3. Radio (km)
    if (radioKmNum != null && !Number.isNaN(radioKmNum) && radioKmNum > 0) {
      const puntoOferta = resolverCoordenadas(
        (oferta as any).ubicacion,
        oferta.localidad,
        oferta.provincia
      );
      if (puntoOferta && puntoOrigen) {
        const km = distanciaKm(puntoOrigen, puntoOferta);
        if (km > radioKmNum) {
          return false;
        }
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
}: {
  filtros: FiltrosOfertaState;
  onChange: (next: FiltrosOfertaState) => void;
  totalResultados: number;
  totalSinFiltrar: number;
}) {
  const hayFiltrosActivos = Boolean(
    filtros.categoria ||
      (filtros.precioMin ?? "").trim() ||
      (filtros.precioMax ?? "").trim() ||
      filtros.radioKm.trim()
  );

  const limpiar = () => onChange(FILTROS_OFERTA_INICIAL);

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
              Buscá lotes por categoría de animales, rango de precio y radio (km)
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

      {/* 2. Rango de Precio (Entre ... y ...) y 3. Radio (km) */}
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

        {/* Filtro Radio (km) */}
        <View className="gap-1.5">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Radio de búsqueda (km)
          </Text>
          <View className="flex-row items-center gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2">
            <Icon name="mapPin" size={16} className="text-clay-600" />
            <TextInput
              value={filtros.radioKm}
              onChangeText={(t) =>
                onChange({ ...filtros, radioKm: t.replace(/[^0-9]/g, "") })
              }
              placeholder="Ej: 200 km (todos los radios)"
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
                      : "border-line-soft bg-surface-soft",
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
