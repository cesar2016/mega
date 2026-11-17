import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "components/ui/Icon";
import { Badge } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { coordenadasProvincia, LISTA_PROVINCIAS, puntoWKT } from "lib/provincias";
import { insertDemanda } from "lib/hooks/useDemandaDB";

const CATEGORIAS = [
  "Novillos",
  "Vaquillonas",
  "Terneros",
  "Vacas",
  "Toros",
  "Conserva",
  "Variados",
];

const RAZAS_POPULARES = [
  "Todas / Cruza",
  "Angus",
  "Hereford",
  "Brangus",
  "Braford",
  "Holando",
  "Limousin",
];

const RADIOS_KM = [50, 100, 200, 300, 500];

const PRESETS_PESO = [
  { label: "Novillos (260 – 450 kg)", min: 260, max: 450, cat: "Novillos" },
  { label: "Terneros (160 – 220 kg)", min: 160, max: 220, cat: "Terneros" },
  { label: "Vaquillonas (240 – 320 kg)", min: 240, max: 320, cat: "Vaquillonas" },
  { label: "Pesados (> 450 kg)", min: 450, max: 550, cat: "Novillos" },
];

export type DemandaCreateModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (matchesCount: number) => void;
};

export function DemandaCreateModal({
  visible,
  onClose,
  onSuccess,
}: DemandaCreateModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useAuthStore((state) => state.profile);
  const user = useAuthStore((state) => state.user);

  // Form states
  const [categoria, setCategoria] = useState("Novillos");
  const [raza, setRaza] = useState("");
  const [pesoMin, setPesoMin] = useState("260");
  const [pesoMax, setPesoMax] = useState("450");
  const [precioMinRef, setPrecioMinRef] = useState("2500");
  const [precioMax, setPrecioMax] = useState("3500");
  const [tipoPrecio, setTipoPrecio] = useState<"por_kilo" | "por_cabeza" | "a_convenir">("por_kilo");
  const [radioKm, setRadioKm] = useState(500);
  const [provincia, setProvincia] = useState(profile?.provincia || "Córdoba");
  const [localidad, setLocalidad] = useState(profile?.localidad || "");
  const [cantidadMin, setCantidadMin] = useState("");
  const [cantidadMax, setCantidadMax] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [resultadoMatch, setResultadoMatch] = useState<{ count: number } | null>(null);

  // Selector de provincia modal / lista
  const [mostrarProvincias, setMostrarProvincias] = useState(false);

  const aplicarPreset = (preset: (typeof PRESETS_PESO)[0]) => {
    setCategoria(preset.cat);
    setPesoMin(String(preset.min));
    setPesoMax(String(preset.max));
  };

  const aplicarEjemploCompleto = () => {
    setCategoria("Novillos");
    setRaza("");
    setPesoMin("260");
    setPesoMax("450");
    setPrecioMinRef("2500");
    setPrecioMax("3500");
    setTipoPrecio("por_kilo");
    setRadioKm(500);
    setProvincia(profile?.provincia || "Córdoba");
    showToast("Ejemplo cargado: Novillo, 260-450 kg, $2500-3500, radio 500 km", "info");
  };

  const handleGuardar = async () => {
    if (!user?.id) {
      showToast("Debés iniciar sesión para publicar una búsqueda", "error");
      router.push("/auth");
      return;
    }

    if (!categoria.trim()) {
      showToast("Por favor seleccioná una categoría", "error");
      return;
    }

    if (!provincia.trim()) {
      showToast("Por favor seleccioná una provincia de referencia", "error");
      return;
    }

    const pMin = pesoMin ? parseFloat(pesoMin.replace(",", ".")) : null;
    const pMax = pesoMax ? parseFloat(pesoMax.replace(",", ".")) : null;

    if (pMin != null && pMax != null && pMin > pMax) {
      showToast("El peso mínimo no puede ser mayor al peso máximo", "error");
      return;
    }

    const prMax = precioMax ? parseFloat(precioMax.replace(",", ".")) : null;
    if (prMax != null && prMax <= 0) {
      showToast("El precio máximo debe ser mayor a 0", "error");
      return;
    }

    const cMin = cantidadMin ? parseInt(cantidadMin, 10) : null;
    const cMax = cantidadMax ? parseInt(cantidadMax, 10) : null;
    if (cMin != null && cMax != null && cMin > cMax) {
      showToast("La cantidad mínima no puede superar la máxima", "error");
      return;
    }

    // Calcular coordenadas geográficas de la provincia para PostGIS
    const coord = coordenadasProvincia(provincia);
    const ubicacionWkt = coord ? puntoWKT(coord) : null;

    setGuardando(true);
    try {
      const res = await insertDemanda({
        comprador_id: user.id,
        categoria: categoria.trim(),
        raza: raza.trim() === "Todas / Cruza" ? null : raza.trim() || null,
        peso_min_kg: pMin,
        peso_max_kg: pMax,
        precio_max: prMax,
        tipo_precio: tipoPrecio,
        radio_km: radioKm,
        provincia: provincia.trim(),
        localidad: localidad.trim() || null,
        cantidad_min: cMin,
        cantidad_max: cMax,
        ubicacion: ubicacionWkt,
      });

      // Refrescar cachés de demandas y de matches
      queryClient.invalidateQueries({ queryKey: ["demandas_activas"] });
      queryClient.invalidateQueries({ queryKey: ["demandas_comprador"] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });

      setResultadoMatch({ count: res.matchesCount });
      onSuccess?.(res.matchesCount);
    } catch (err: any) {
      showToast(err?.message || "No se pudo guardar la búsqueda", "error");
    } finally {
      setGuardando(false);
    }
  };

  const handleCerrarTodo = () => {
    setResultadoMatch(null);
    onClose();
  };

  const irAMatches = () => {
    handleCerrarTodo();
    router.push("/(main)/tabs/matches");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={resultadoMatch ? handleCerrarTodo : onClose}
    >
      <View className="flex-1 justify-center bg-black/60 p-3 md:items-center md:p-6">
        <View className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-card">
          {/* Header del Modal */}
          <View className="flex-row items-center justify-between border-b border-line-soft bg-canvas px-5 py-4">
            <View className="min-w-0 flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <View className="h-7 w-7 items-center justify-center rounded-lg bg-sky-100">
                  <Icon name="search" size={15} className="text-sky-600" />
                </View>
                <Text className="text-xs font-bold uppercase tracking-wide text-sky-700">
                  Búsqueda de hacienda
                </Text>
              </View>
              <Text className="text-lg font-extrabold text-ink">
                ¿Qué estás buscando comprar?
              </Text>
            </View>

            <Pressable
              onPress={resultadoMatch ? handleCerrarTodo : onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              className="h-9 w-9 items-center justify-center rounded-full border border-line bg-surface active:bg-surface-sunk"
            >
              <Icon name="x" size={18} className="text-ink-soft" />
            </Pressable>
          </View>

          {/* Si se generó el match, mostramos la pantalla de celebración/resultado */}
          {resultadoMatch ? (
            <View className="items-center gap-5 p-7 text-center">
              <View className="h-16 w-16 items-center justify-center rounded-3xl bg-sage-100">
                <Icon name="sparkles" size={32} className="text-sage-600" />
              </View>

              <View className="gap-2 items-center">
                <Badge tone="sage" icon="badgeCheck">
                  Búsqueda activa y registrada
                </Badge>
                <Text className="text-2xl font-black text-ink text-center">
                  {resultadoMatch.count > 0
                    ? `¡Encontramos ${resultadoMatch.count} ${
                        resultadoMatch.count === 1 ? "lote compatible!" : "lotes compatibles!"
                      }`
                    : "¡Búsqueda activada con éxito!"}
                </Text>
                <Text className="text-sm text-ink-soft text-center max-w-md">
                  {resultadoMatch.count > 0
                    ? `El sistema cruzó tu pedido de ${categoria} (${pesoMin}-${pesoMax} kg, radio ${radioKm} km) y encontró ofertas que coinciden.`
                    : `Tu pedido de ${categoria} (${pesoMin}-${pesoMax} kg en un radio de ${radioKm} km) quedó activo. Te avisaremos apenas un productor publique un lote que coincida.`}
                </Text>
              </View>

              <View className="w-full flex-col gap-2.5 pt-2 sm:flex-row">
                {resultadoMatch.count > 0 ? (
                  <Button
                    label={`Ver mis ${resultadoMatch.count} ${
                      resultadoMatch.count === 1 ? "match" : "matches"
                    }`}
                    icon="sparkles"
                    onPress={irAMatches}
                    className="flex-1"
                  />
                ) : null}
                <Button
                  label="Continuar en Demandas"
                  variant="secondary"
                  onPress={handleCerrarTodo}
                  className="flex-1"
                />
              </View>
            </View>
          ) : (
            <ScrollView
              className="p-5"
              contentContainerStyle={{ gap: 20, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Botón de llenado rápido del ejemplo */}
              <Pressable
                onPress={aplicarEjemploCompleto}
                className="flex-row items-center justify-between rounded-2xl border border-sky-200 bg-sky-50/70 p-3 active:bg-sky-100"
              >
                <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
                  <View className="h-8 w-8 items-center justify-center rounded-xl bg-white shadow-soft">
                    <Icon name="sparkles" size={16} className="text-sky-600" />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs font-bold text-sky-800">
                      Cargar ejemplo solicitado:
                    </Text>
                    <Text className="text-[11px] text-sky-600">
                      Novillo, 260-450 kg, $2500-3500 a 500 km a la redonda
                    </Text>
                  </View>
                </View>
                <Badge tone="sky">Autocompletar</Badge>
              </Pressable>

              {/* 1. Categoría */}
              <View className="gap-2">
                <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  1. Categoría de hacienda
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIAS.map((cat) => {
                    const sel = categoria === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setCategoria(cat)}
                        className={[
                          "flex-row items-center gap-1.5 rounded-xl border px-3.5 py-2",
                          sel
                            ? "border-sage-600 bg-sage-500 shadow-soft"
                            : "border-line bg-surface active:bg-surface-sunk",
                        ].join(" ")}
                      >
                        {sel ? <Icon name="check" size={13} className="text-white" /> : null}
                        <Text
                          className={[
                            "text-xs font-bold",
                            sel ? "text-white" : "text-ink-soft",
                          ].join(" ")}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* 2. Rango de peso */}
              <View className="gap-2.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    2. Rango de peso (kg)
                  </Text>
                  <Text className="text-[11px] font-semibold text-ink-muted">
                    {pesoMin && pesoMax ? `${pesoMin} a ${pesoMax} kg` : "A definir"}
                  </Text>
                </View>

                {/* Presets rápidos de peso */}
                <View className="flex-row flex-wrap gap-1.5">
                  {PRESETS_PESO.map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => aplicarPreset(p)}
                      className="rounded-lg border border-line-soft bg-surface-soft px-2.5 py-1 active:bg-surface-sunk"
                    >
                      <Text className="text-[11px] font-medium text-ink-soft">{p.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Input
                      label="Peso mínimo (kg)"
                      value={pesoMin}
                      onChangeText={setPesoMin}
                      placeholder="Ej: 260"
                      keyboardType="numeric"
                      icon="scale"
                    />
                  </View>
                  <View className="pt-5">
                    <Text className="text-sm font-bold text-ink-muted">—</Text>
                  </View>
                  <View className="flex-1">
                    <Input
                      label="Peso máximo (kg)"
                      value={pesoMax}
                      onChangeText={setPesoMax}
                      placeholder="Ej: 450"
                      keyboardType="numeric"
                      icon="scale"
                    />
                  </View>
                </View>
              </View>

              {/* 3. Precio y presupuesto */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  3. Presupuesto y Precio
                </Text>

                {/* Modalidad de precio */}
                <View className="flex-row gap-2">
                  {[
                    { key: "por_kilo", label: "Por kilo" },
                    { key: "por_cabeza", label: "Por cabeza" },
                    { key: "a_convenir", label: "A convenir" },
                  ].map((m) => {
                    const sel = tipoPrecio === m.key;
                    return (
                      <Pressable
                        key={m.key}
                        onPress={() => setTipoPrecio(m.key as any)}
                        className={[
                          "flex-1 items-center rounded-xl border py-2",
                          sel
                            ? "border-sky-500 bg-sky-50 text-sky-700 font-bold"
                            : "border-line bg-surface active:bg-surface-sunk",
                        ].join(" ")}
                      >
                        <Text
                          className={[
                            "text-xs font-semibold",
                            sel ? "text-sky-700 font-bold" : "text-ink-soft",
                          ].join(" ")}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {tipoPrecio !== "a_convenir" ? (
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Input
                        label="Precio de referencia mín. ($)"
                        value={precioMinRef}
                        onChangeText={setPrecioMinRef}
                        placeholder="Ej: 2500"
                        keyboardType="numeric"
                        icon="coins"
                        hint="Rango sugerido"
                      />
                    </View>
                    <View className="pt-4">
                      <Text className="text-sm font-bold text-ink-muted">—</Text>
                    </View>
                    <View className="flex-1">
                      <Input
                        label="Precio tope / máx. ($)"
                        value={precioMax}
                        onChangeText={setPrecioMax}
                        placeholder="Ej: 3500"
                        keyboardType="numeric"
                        icon="coins"
                        hint="Tope que pagás"
                      />
                    </View>
                  </View>
                ) : null}
              </View>

              {/* 4. Radio de búsqueda a la redonda */}
              <View className="gap-2.5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                    4. Radio de búsqueda a la redonda
                  </Text>
                  <Badge tone="clay" icon="signal">
                    Hasta {radioKm} km
                  </Badge>
                </View>

                <View className="flex-row gap-2">
                  {RADIOS_KM.map((km) => {
                    const sel = radioKm === km;
                    return (
                      <Pressable
                        key={km}
                        onPress={() => setRadioKm(km)}
                        className={[
                          "flex-1 items-center rounded-xl border py-2",
                          sel
                            ? "border-clay-500 bg-clay-500 shadow-soft"
                            : "border-line bg-surface active:bg-surface-sunk",
                        ].join(" ")}
                      >
                        <Text
                          className={[
                            "text-xs font-bold",
                            sel ? "text-white" : "text-ink-soft",
                          ].join(" ")}
                        >
                          {km} km
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text className="text-[11px] text-ink-muted">
                  Buscamos lotes disponibles dentro de los {radioKm} km a la redonda de tu ubicación.
                </Text>
              </View>

              {/* 5. Ubicación (Provincia y Localidad) */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  5. Ubicación de recepción / campo
                </Text>

                <View className="gap-2">
                  <Text className="text-xs font-semibold text-ink-soft uppercase">
                    Provincia
                  </Text>
                  <Pressable
                    onPress={() => setMostrarProvincias(!mostrarProvincias)}
                    className="flex-row items-center justify-between rounded-2xl border border-line bg-surface px-3.5 py-3 active:bg-surface-sunk"
                  >
                    <View className="flex-row items-center gap-2">
                      <Icon name="mapPin" size={16} className="text-clay-500" />
                      <Text className="text-sm font-bold text-ink">{provincia}</Text>
                    </View>
                    <Icon
                      name={mostrarProvincias ? "chevronDown" : "chevronRight"}
                      size={16}
                      className="text-ink-muted"
                    />
                  </Pressable>

                  {mostrarProvincias ? (
                    <View className="max-h-48 overflow-hidden rounded-2xl border border-line bg-canvas p-2">
                      <ScrollView nestedScrollEnabled className="max-h-44">
                        {LISTA_PROVINCIAS.map((p) => (
                          <Pressable
                            key={p}
                            onPress={() => {
                              setProvincia(p);
                              setMostrarProvincias(false);
                            }}
                            className={[
                              "flex-row items-center justify-between rounded-xl px-3 py-2",
                              provincia === p ? "bg-sage-100" : "active:bg-surface-sunk",
                            ].join(" ")}
                          >
                            <Text
                              className={[
                                "text-xs",
                                provincia === p ? "font-bold text-sage-800" : "text-ink-soft",
                              ].join(" ")}
                            >
                              {p}
                            </Text>
                            {provincia === p ? (
                              <Icon name="check" size={14} className="text-sage-700" />
                            ) : null}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>

                <Input
                  label="Localidad / Zona (opcional)"
                  value={localidad}
                  onChangeText={setLocalidad}
                  placeholder="Ej: Río Cuarto, Olavarría, Rafaela..."
                  icon="mapPin"
                />
              </View>

              {/* 6. Raza y Cantidad (Opcionales) */}
              <View className="gap-2.5">
                <Text className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  6. Preferencias adicionales (Opcional)
                </Text>

                <View className="gap-2">
                  <Text className="text-xs font-semibold text-ink-soft uppercase">
                    Raza deseada
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {RAZAS_POPULARES.map((r) => {
                      const sel = (r === "Todas / Cruza" && !raza) || raza === r;
                      return (
                        <Pressable
                          key={r}
                          onPress={() => setRaza(r === "Todas / Cruza" ? "" : r)}
                          className={[
                            "rounded-lg border px-2.5 py-1.5",
                            sel
                              ? "border-sage-500 bg-sage-50"
                              : "border-line-soft bg-surface active:bg-surface-sunk",
                          ].join(" ")}
                        >
                          <Text
                            className={[
                              "text-xs font-semibold",
                              sel ? "text-sage-700" : "text-ink-soft",
                            ].join(" ")}
                          >
                            {r}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Input
                      label="Cabezas mínimas"
                      value={cantidadMin}
                      onChangeText={setCantidadMin}
                      placeholder="Ej: 30"
                      keyboardType="numeric"
                      icon="boxes"
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      label="Cabezas máximas"
                      value={cantidadMax}
                      onChangeText={setCantidadMax}
                      placeholder="Ej: 100"
                      keyboardType="numeric"
                      icon="boxes"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          {/* Footer con acciones */}
          {!resultadoMatch ? (
            <View className="flex-row items-center justify-end gap-2 border-t border-line-soft bg-canvas px-5 py-4">
              <Button label="Cancelar" variant="secondary" onPress={onClose} disabled={guardando} />
              <Button
                label={guardando ? "Buscando lotes..." : "Guardar y hacer match"}
                icon="sparkles"
                onPress={handleGuardar}
                loading={guardando}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
