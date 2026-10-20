import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useForm } from "react-hook-form";
import { z } from "zod";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "lib/supabase";
import { showToast } from "lib/utils";
import { extensionForMime, toUploadBody } from "lib/upload";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import {
  useOfferMedia,
  MAX_IMAGES,
  MAX_VIDEOS,
  MAX_VIDEO_DURATION,
} from "./useOfferMedia";

const OfferSchema = z.object({
  categoria: z.string().min(1, "Categoría requerida"),
  raza: z.string().optional(),
  cantidad: z.number().int().min(1, "Cantidad debe ser > 0"),
  peso_promedio: z.number().min(0, "Peso debe ser >= 0").optional(),
  edad: z.string().optional(),
  precio: z.number().positive("Precio debe ser > 0"),
  tipo_precio: z.enum(["por_kilo", "por_cabeza", "a_convenir"]),
  descripcion: z.string().optional(),
  provincia: z.string().min(1, "Provincia requerida"),
  localidad: z.string().optional(),
});

const TIPOS_PRECIO: { valor: "por_kilo" | "por_cabeza" | "a_convenir"; label: string }[] = [
  { valor: "por_kilo", label: "Por kilo" },
  { valor: "por_cabeza", label: "Por cabeza" },
  { valor: "a_convenir", label: "A convenir" },
];

const CATEGORIAS = ["Novillos", "Vaquillonas", "Terneros", "Vacas", "Toros", "Corrales"];

export default function OfferCreateScreen() {
  const user = useAuthStore((state) => state.user);
  const form = useForm();
  const {
    addPhoto,
    addVideo,
    removeMedia,
    clearAll,
    fotos,
    videos,
    portadaId,
    setPortada,
    totalMedia,
    isMaxReached,
  } = useOfferMedia();
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);

  // Suscribirse a los valores mantiene controlados los inputs
  const values = form.watch();

  const onSubmit = async () => {
    if (!user) {
      showToast("Necesitás iniciar sesión para publicar", "error");
      return;
    }

    try {
      setSubmitting(true);
      const validated = OfferSchema.parse(form.getValues());

      // 1. Subir medios a Supabase Storage (direct upload con firmado)
      const urlPorId: Record<string, string> = {};

      for (const foto of fotos) {
        const extension = extensionForMime(foto.mimeType, "jpg");
        const path = `${user.id}/${foto.id}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("oferta_media")
          .upload(path, await toUploadBody(foto.uri), {
            // El bucket sólo acepta mime types concretos (no comodines).
            contentType: foto.mimeType ?? "image/jpeg",
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("oferta_media").getPublicUrl(path);

        urlPorId[foto.id] = data.publicUrl;
      }

      for (const video of videos) {
        const extension = extensionForMime(video.mimeType, "mp4");
        const path = `${user.id}/${video.id}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("oferta_media")
          .upload(path, await toUploadBody(video.uri), {
            contentType: video.mimeType ?? "video/mp4",
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("oferta_media").getPublicUrl(path);

        urlPorId[video.id] = data.publicUrl;
      }

      // 2. Insertar oferta en la base de datos
      const { data: ofertaRow, error: dbError } = await supabase
        .from("ofertas")
        .insert({
          productor_id: user.id,
          categoria: validated.categoria,
          raza: validated.raza,
          cantidad: validated.cantidad,
          peso_promedio: validated.peso_promedio,
          edad: validated.edad,
          precio: validated.precio,
          tipo_precio: validated.tipo_precio,
          descripcion: validated.descripcion,
          provincia: validated.provincia,
          localidad: validated.localidad,
          ubicacion: null, // geografía point - requeriría geolocalización
          estado: "activa",
          vigencia: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
        })
        .select("id")
        .single();

      if (dbError) throw dbError;

      // 3. Asociar medios a la oferta (la foto elegida es la portada)
      const mediaRows = [
        ...fotos.map((foto) => ({
          oferta_id: ofertaRow.id,
          tipo: "foto" as const,
          url: urlPorId[foto.id],
          orden: foto.orden,
          es_portada: foto.id === portadaId,
        })),
        ...videos.map((video) => ({
          oferta_id: ofertaRow.id,
          tipo: "video" as const,
          url: urlPorId[video.id],
          duracion_segundos: video.duracion ?? null,
          orden: video.orden,
          es_portada: false,
        })),
      ];

      if (mediaRows.length > 0) {
        const { error: mediaError } = await supabase
          .from("oferta_media")
          .insert(mediaRows);

        if (mediaError) throw mediaError;
      }

      clearAll();
      router.replace("/(main)/tabs/feed");
      showToast("Oferta publicada exitosamente!", "success");
    } catch (err: any) {
      console.error("Error al publicar oferta:", err);
      showToast(err?.message || "Error al publicar la oferta", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Manejar selección de imagen desde la galería
  const pickerFoto = useCallback(async () => {
    if (isMaxReached("foto")) {
      showToast("Máximo " + MAX_IMAGES + " fotos permitidas", "error");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        addPhoto(result.assets[0].uri, result.assets[0].mimeType);
      }
    } catch (err) {
      console.error("Error picking image:", err);
    }
  }, [addPhoto, isMaxReached]);

  const pickerVideo = useCallback(async () => {
    if (isMaxReached("video")) {
      showToast("Máximo " + MAX_VIDEOS + " videos permitidas", "error");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const duracion = Math.round(result.assets[0].duration ?? 0);
        if (duracion > MAX_VIDEO_DURATION) {
          showToast(
            `Los videos deben tener como máximo ${MAX_VIDEO_DURATION} segundos`,
            "error"
          );
          return;
        }
        addVideo(result.assets[0].uri, duracion, result.assets[0].mimeType);
      }
    } catch (err) {
      console.error("Error picking video:", err);
    }
  }, [addVideo, isMaxReached]);

  const puedePublicar =
    !!values.categoria &&
    !!values.cantidad &&
    !!values.precio &&
    !!values.tipo_precio &&
    !!values.provincia;

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Publicar oferta" onBack={() => router.back()} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Screen
          eyebrow="Nuevo lote"
          title="Publicar oferta"
          subtitle="Cargá los datos del lote: los compradores y fleteros los ven al instante."
          action={
            <Button
              label="Cancelar"
              variant="secondary"
              onPress={() => router.back()}
              className="hidden md:flex"
            />
          }
        >
          <View className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Formulario */}
            <View className="gap-6">
              <Card className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sage-50">
                    <Icon name="beef" size={19} className="text-sage-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">Datos del lote</Text>
                    <Text className="text-xs text-ink-muted">Qué estás vendiendo</Text>
                  </View>
                </View>

                <Input
                  label="Categoría"
                  value={values.categoria ?? ""}
                  onChangeText={(text) => form.setValue("categoria", text)}
                  placeholder="Ej: novillos, vaquillonas, terneros..."
                  icon="tag"
                />

                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIAS.map((categoria) => {
                    const activa = values.categoria === categoria;
                    return (
                      <Pressable
                        key={categoria}
                        onPress={() => form.setValue("categoria", categoria)}
                        accessibilityRole="button"
                        className={[
                          "rounded-full border px-3.5 py-1.5",
                          activa
                            ? "border-sage-500 bg-sage-500"
                            : "border-line bg-surface active:bg-surface-sunk",
                        ].join(" ")}
                      >
                        <Text
                          className={[
                            "text-xs font-semibold",
                            activa ? "text-white" : "text-ink-soft",
                          ].join(" ")}
                        >
                          {categoria}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Raza (opcional)"
                    value={values.raza ?? ""}
                    onChangeText={(text) => form.setValue("raza", text)}
                    placeholder="Ej: Hereford, Angus..."
                    icon="ruler"
                  />
                  <Input
                    label="Cantidad de cabezas"
                    value={values.cantidad !== undefined ? String(values.cantidad) : ""}
                    onChangeText={(text) => form.setValue("cantidad", Number(text))}
                    placeholder="Ej: 12"
                    keyboardType="numeric"
                    icon="boxes"
                  />
                  <Input
                    label="Peso promedio (kg)"
                    value={values.peso_promedio !== undefined ? String(values.peso_promedio) : ""}
                    onChangeText={(text) =>
                      form.setValue("peso_promedio", text ? Number(text) : undefined)
                    }
                    placeholder="Ej: 430"
                    keyboardType="numeric"
                    icon="scale"
                  />
                  <Input
                    label="Edad aproximada"
                    value={values.edad ?? ""}
                    onChangeText={(text) => form.setValue("edad", text)}
                    placeholder="Ej: a destete, termina, adulta"
                    icon="calendar"
                  />
                </View>
              </Card>

              <Card className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-clay-50">
                    <Icon name="coins" size={19} className="text-clay-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">Precio</Text>
                    <Text className="text-xs text-ink-muted">Cómo se calcula</Text>
                  </View>
                </View>

                <Input
                  label="Precio"
                  value={values.precio !== undefined ? String(values.precio) : ""}
                  onChangeText={(text) => form.setValue("precio", Number(text))}
                  placeholder="Ej: 2500"
                  keyboardType="numeric"
                  icon="tag"
                />

                <View className="gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Tipo de precio
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {TIPOS_PRECIO.map((tipo) => {
                      const activo = values.tipo_precio === tipo.valor;
                      return (
                        <Pressable
                          key={tipo.valor}
                          onPress={() => form.setValue("tipo_precio", tipo.valor)}
                          accessibilityRole="button"
                          className={[
                            "rounded-2xl border px-4 py-2.5",
                            activo
                              ? "border-sage-500 bg-sage-50"
                              : "border-line bg-surface active:bg-surface-sunk",
                          ].join(" ")}
                        >
                          <Text
                            className={[
                              "text-sm font-semibold",
                              activo ? "text-sage-700" : "text-ink-soft",
                            ].join(" ")}
                          >
                            {tipo.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Card>

              <Card className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sky-50">
                    <Icon name="mapPin" size={19} className="text-sky-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">Ubicación y detalles</Text>
                    <Text className="text-xs text-ink-muted">Dónde está el lote</Text>
                  </View>
                </View>

                <View className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="Provincia"
                    value={values.provincia ?? ""}
                    onChangeText={(text) => form.setValue("provincia", text)}
                    placeholder="Ej: Córdoba, Santa Fe..."
                    icon="mapPin"
                  />
                  <Input
                    label="Localidad (opcional)"
                    value={values.localidad ?? ""}
                    onChangeText={(text) => form.setValue("localidad", text)}
                    placeholder="Ej: Río Cuarto"
                    icon="mapPin"
                  />
                </View>

                <Input
                  label="Descripción"
                  value={values.descripcion ?? ""}
                  onChangeText={(text) => form.setValue("descripcion", text)}
                  placeholder="Detalles adicionales sobre el lote..."
                  multiline
                  numberOfLines={4}
                  icon="clipboard"
                />
              </Card>

              <Card className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-wheat-50">
                    <Icon name="image" size={19} className="text-wheat-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">Galería de medios</Text>
                    <Text className="text-xs text-ink-muted">
                      Hasta {MAX_IMAGES} fotos y {MAX_VIDEOS} videos de {MAX_VIDEO_DURATION}s
                    </Text>
                  </View>
                </View>

                <View className="gap-4">
                  <View className="gap-2">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Fotos (hasta {MAX_IMAGES})
                    </Text>
                    <Text className="text-xs text-ink-muted">
                      Tocá una foto para usarla de portada en la publicación.
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap gap-3">
                    {fotos.map((foto) => {
                      const esPortada = portadaId === foto.id;
                      return (
                        <View
                          key={foto.id}
                          className={[
                            "h-24 w-24 overflow-hidden rounded-2xl border-2 bg-surface-sunk",
                            esPortada ? "border-sage-500" : "border-line-soft",
                          ].join(" ")}
                        >
                          <Pressable
                            onPress={() => setPortada(foto.id)}
                            accessibilityRole="button"
                            accessibilityLabel={
                              esPortada ? "Foto de portada" : "Usar como portada"
                            }
                            className="h-full w-full"
                          >
                            <Image source={{ uri: foto.uri }} className="h-full w-full" />
                          </Pressable>

                          {esPortada ? (
                            <View className="absolute left-1 top-1 flex-row items-center gap-1 rounded-lg bg-sage-600 px-1.5 py-0.5">
                              <Icon name="image" size={10} className="text-white" />
                              <Text className="text-[9px] font-bold text-white">Portada</Text>
                            </View>
                          ) : null}

                          <Pressable
                            onPress={() => removeMedia(foto.id)}
                            accessibilityLabel="Quitar foto"
                            className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-ink/60"
                          >
                            <Icon name="x" size={12} className="text-white" />
                          </Pressable>
                        </View>
                      );
                    })}

                    <Pressable
                      onPress={pickerFoto}
                      disabled={isMaxReached("foto")}
                      accessibilityLabel="Añadir foto"
                      className={[
                        "h-24 w-24 items-center justify-center gap-1 rounded-2xl border border-dashed",
                        isMaxReached("foto")
                          ? "border-line bg-surface-sunk opacity-50"
                          : "border-sage-300 bg-sage-50 active:bg-sage-100",
                      ].join(" ")}
                    >
                      <Icon name="camera" size={20} className="text-sage-600" />
                      <Text className="text-[10px] font-semibold text-sage-700">
                        {fotos.length}/{MAX_IMAGES}
                      </Text>
                    </Pressable>
                  </View>

                  <View className="gap-2">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Videos (hasta {MAX_VIDEOS})
                    </Text>
                    <View className="flex-row flex-wrap gap-3">
                      {videos.map((video) => (
                        <View
                          key={video.id}
                          className="h-24 w-32 overflow-hidden rounded-2xl border border-line-soft bg-surface-sunk"
                        >
                          <Image source={{ uri: video.uri }} className="h-full w-full" />
                          <View className="absolute bottom-1 right-1 rounded-lg bg-ink/70 px-1.5 py-0.5">
                            <Text className="text-[10px] font-semibold text-white">
                              {video.duracion}s
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => removeMedia(video.id)}
                            accessibilityLabel="Quitar video"
                            className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-ink/60"
                          >
                            <Icon name="x" size={12} className="text-white" />
                          </Pressable>
                        </View>
                      ))}

                      <Pressable
                        onPress={pickerVideo}
                        disabled={isMaxReached("video")}
                        accessibilityLabel="Añadir video"
                        className={[
                          "h-24 w-32 items-center justify-center gap-1 rounded-2xl border border-dashed",
                          isMaxReached("video")
                            ? "border-line bg-surface-sunk opacity-50"
                            : "border-clay-300 bg-clay-50 active:bg-clay-100",
                        ].join(" ")}
                      >
                        <Icon name="video" size={20} className="text-clay-600" />
                        <Text className="text-[10px] font-semibold text-clay-700">
                          {videos.length}/{MAX_VIDEOS}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Card>
            </View>

            {/* Resumen lateral (escritorio) */}
            <View className="gap-4 lg:sticky lg:top-6 lg:self-start">
              <Gradient
                colors={["#E4EDE5", "#F8E6DA"]}
                className="gap-4 rounded-3xl border border-line-soft p-5"
              >
                <View className="flex-row items-center gap-2">
                  <Icon name="sparkles" size={16} className="text-sage-600" />
                  <Text className="text-sm font-bold text-ink">Resumen del lote</Text>
                </View>

                <View className="gap-2">
                  <ResumenFila label="Categoría" value={values.categoria || "—"} />
                  <ResumenFila label="Raza" value={values.raza || "—"} />
                  <ResumenFila
                    label="Cantidad"
                    value={values.cantidad ? `${values.cantidad} cab.` : "—"}
                  />
                  <ResumenFila
                    label="Peso prom."
                    value={values.peso_promedio ? `${values.peso_promedio} kg` : "—"}
                  />
                  <ResumenFila
                    label="Precio"
                    value={values.precio ? `$${Number(values.precio).toLocaleString("es-AR")}` : "—"}
                  />
                  <ResumenFila
                    label="Ubicación"
                    value={
                      [values.localidad, values.provincia].filter(Boolean).join(", ") || "—"
                    }
                  />
                </View>

                <View className="flex-row items-center gap-2">
                  <Badge tone="sage" icon="image">
                    {totalMedia()} adjunto(s)
                  </Badge>
                  <Badge tone="sky" icon="handshake">
                    Match automático
                  </Badge>
                </View>
              </Gradient>

              <Card className="gap-3">
                {submitting ? (
                  <ActivityIndicator className="text-sage-500" />
                ) : (
                  <Button
                    label="Publicar oferta"
                    icon="checkCircle"
                    size="lg"
                    fullWidth
                    onPress={onSubmit}
                    disabled={!puedePublicar}
                  />
                )}

                <Text className="text-center text-[11px] leading-4 text-ink-muted">
                  La oferta queda activa durante 30 días y se cruza automáticamente con las
                  demandas del mercado.
                </Text>

                {Platform.OS === "web" ? (
                  <Text className="text-center text-[11px] text-ink-muted">
                    Ejecutando en navegador (web).
                  </Text>
                ) : null}
              </Card>
            </View>
          </View>
        </Screen>
      </ScrollView>
    </View>
  );
}

function ResumenFila({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-xs text-ink-muted">{label}</Text>
      <Text className="flex-1 text-right text-xs font-semibold text-ink" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
