import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "lib/supabase";
import {
  deleteOferta,
  storagePathFromPublicUrl,
  updateOferta,
  useOfertaById,
} from "lib/hooks/useOfferDB";
import { showToast } from "lib/utils";
import { extensionForMime, toUploadBody } from "lib/upload";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { EmptyState } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";
import { buildVideoTrimUrl } from "components/ui/OfertaMedia";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";
import {
  useOfferMedia,
  MAX_IMAGES,
  MAX_VIDEOS,
  MAX_VIDEO_DURATION,
} from "./useOfferMedia";
import { VideoGalleryCard, VideoTrimModal } from "./VideoTrimModal";
import type { VideoTrimResult } from "./VideoTrimModal";

type VideoPendienteRecorte = {
  id?: string;
  uri: string;
  mimeType?: string;
  duracionInicial: number;
  trimInicio?: number;
  trimFin?: number;
};

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
  estado: z.enum(["activa", "completada", "cancelada", "vencida"]).optional(),
});

const TIPOS_PRECIO: { valor: "por_kilo" | "por_cabeza" | "a_convenir"; label: string }[] = [
  { valor: "por_kilo", label: "Por kilo" },
  { valor: "por_cabeza", label: "Por cabeza" },
  { valor: "a_convenir", label: "A convenir" },
];

const ESTADOS_OFERTA: { valor: "activa" | "completada" | "cancelada"; label: string }[] = [
  { valor: "activa", label: "Activa" },
  { valor: "completada", label: "Completada / Vendida" },
  { valor: "cancelada", label: "Pausada / Cancelada" },
];

const CATEGORIAS = ["Novillos", "Vaquillonas", "Terneros", "Vacas", "Toros", "Corrales"];

export default function OfferCreateScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ofertaId = id ? String(id) : "";
  const esEdicion = Boolean(ofertaId);

  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const form = useForm();
  const {
    addPhotos,
    addVideo,
    updateVideo,
    loadInitialMedia,
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
  const [submitting, setSubmitting] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [videoEnEdicion, setVideoEnEdicion] = useState<VideoPendienteRecorte | null>(null);

  const {
    data: ofertaExistente,
    isLoading: cargandoOferta,
    error: errorOferta,
  } = useOfertaById(ofertaId);

  const hidratadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!esEdicion) {
      hidratadoRef.current = null;
      return;
    }
    if (!ofertaExistente || hidratadoRef.current === ofertaExistente.id) return;

    hidratadoRef.current = ofertaExistente.id;
    form.reset({
      categoria: ofertaExistente.categoria ?? "",
      raza: ofertaExistente.raza ?? "",
      cantidad:
        ofertaExistente.cantidad !== null && ofertaExistente.cantidad !== undefined
          ? Number(ofertaExistente.cantidad)
          : undefined,
      peso_promedio:
        ofertaExistente.peso_promedio !== null && ofertaExistente.peso_promedio !== undefined
          ? Number(ofertaExistente.peso_promedio)
          : undefined,
      edad: ofertaExistente.edad ?? "",
      precio:
        ofertaExistente.precio !== null && ofertaExistente.precio !== undefined
          ? Number(ofertaExistente.precio)
          : undefined,
      tipo_precio: ofertaExistente.tipo_precio ?? "por_kilo",
      descripcion: ofertaExistente.descripcion ?? "",
      provincia: ofertaExistente.provincia ?? "",
      localidad: ofertaExistente.localidad ?? "",
      estado: ofertaExistente.estado ?? "activa",
    });
    loadInitialMedia((ofertaExistente.oferta_media ?? []) as OfertaMediaRow[]);
  }, [esEdicion, ofertaExistente, form, loadInitialMedia]);

  // Suscribirse a los valores mantiene controlados los inputs
  const values = form.watch();

  const invalidarConsultas = async (targetId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ofertas_activas"] }),
      queryClient.invalidateQueries({ queryKey: ["ofertas_productor"] }),
      queryClient.invalidateQueries({ queryKey: ["matches"] }),
      targetId
        ? queryClient.invalidateQueries({ queryKey: ["oferta", targetId] })
        : Promise.resolve(),
    ]);
  };

  const onSubmit = async () => {
    if (!user) {
      showToast("Necesitás iniciar sesión para publicar", "error");
      return;
    }

    try {
      setSubmitting(true);
      const rawValues = form.getValues();
      const validated = OfferSchema.parse({
        ...rawValues,
        raza: rawValues.raza || undefined,
        edad: rawValues.edad || undefined,
        descripcion: rawValues.descripcion || undefined,
        localidad: rawValues.localidad || undefined,
      });

      // 1. Subir medios nuevos a Supabase Storage (los que ya tienen `url` se conservan)
      const urlPorId: Record<string, string> = {};

      for (const foto of fotos) {
        if (foto.url) {
          urlPorId[foto.id] = foto.url;
          continue;
        }
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
        let baseVideoUrl = video.url;
        if (!baseVideoUrl) {
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
          baseVideoUrl = data.publicUrl;
        }

        urlPorId[video.id] = buildVideoTrimUrl(
          baseVideoUrl,
          video.trimInicio,
          video.trimFin,
          video.duracionOriginal
        );
      }

      let targetOfertaId = ofertaId;

      if (esEdicion) {
        // 2a. Actualizar oferta existente
        await updateOferta(ofertaId, {
          categoria: validated.categoria,
          raza: validated.raza ?? null,
          cantidad: validated.cantidad,
          peso_promedio: validated.peso_promedio ?? null,
          edad: validated.edad ?? null,
          precio: validated.precio,
          tipo_precio: validated.tipo_precio,
          descripcion: validated.descripcion ?? null,
          provincia: validated.provincia,
          localidad: validated.localidad ?? null,
          estado: validated.estado ?? "activa",
        });

        // Limpiar de Storage los archivos antiguos que el productor quitó
        const pathsActuales = new Set(
          Object.values(urlPorId)
            .map((u) => storagePathFromPublicUrl(u))
            .filter((p): p is string => p !== null)
        );
        const pathsEliminados = ((ofertaExistente?.oferta_media ?? []) as OfertaMediaRow[])
          .map((m) => storagePathFromPublicUrl(m.url))
          .filter((p): p is string => p !== null && !pathsActuales.has(p));

        if (pathsEliminados.length > 0) {
          await supabase.storage
            .from("oferta_media")
            .remove(pathsEliminados)
            .catch(() => {});
        }

        // Reemplazar las filas de `oferta_media` de esta oferta con el nuevo orden y portada
        const { error: delMediaError } = await supabase
          .from("oferta_media")
          .delete()
          .eq("oferta_id", ofertaId);

        if (delMediaError) throw delMediaError;
      } else {
        // 2b. Insertar nueva oferta en la base de datos
        const { data: ofertaRow, error: dbError } = await supabase
          .from("ofertas")
          .insert({
            productor_id: user.id,
            categoria: validated.categoria,
            raza: validated.raza ?? null,
            cantidad: validated.cantidad,
            peso_promedio: validated.peso_promedio ?? null,
            edad: validated.edad ?? null,
            precio: validated.precio,
            tipo_precio: validated.tipo_precio,
            descripcion: validated.descripcion ?? null,
            provincia: validated.provincia,
            localidad: validated.localidad ?? null,
            ubicacion: null, // geografía point - requeriría geolocalización
            estado: "activa",
            vigencia: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
          })
          .select("id")
          .single();

        if (dbError) throw dbError;
        targetOfertaId = ofertaRow.id;
      }

      // 3. Asociar medios a la oferta con orden secuencial (1..N) y portada única
      const portadaEfectivaId =
        fotos.some((f) => f.id === portadaId) ? portadaId : (fotos[0]?.id ?? null);

      const mediaRows = [
        ...fotos.map((foto, index) => ({
          oferta_id: targetOfertaId,
          tipo: "foto" as const,
          url: urlPorId[foto.id],
          orden: index + 1,
          es_portada: foto.id === portadaEfectivaId,
        })),
        ...videos.map((video, index) => ({
          oferta_id: targetOfertaId,
          tipo: "video" as const,
          url: urlPorId[video.id],
          duracion_segundos: Math.min(
            MAX_VIDEO_DURATION,
            Math.max(1, Math.round(video.duracion ?? 1))
          ),
          orden: index + 1,
          es_portada: false,
        })),
      ];

      if (mediaRows.length > 0) {
        const { error: mediaError } = await supabase
          .from("oferta_media")
          .insert(mediaRows);

        if (mediaError) throw mediaError;
      }

      await invalidarConsultas(targetOfertaId);

      if (esEdicion) {
        showToast("¡Publicación actualizada exitosamente!", "success");
        router.replace(`/(main)/oferta/${targetOfertaId}`);
      } else {
        clearAll();
        showToast("¡Oferta publicada exitosamente!", "success");
        router.replace("/(main)/tabs/ofertas");
      }
    } catch (err: any) {
      console.error("Error al guardar oferta:", err);
      showToast(err?.message || "Error al guardar la publicación", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const onEliminarOferta = async () => {
    if (!esEdicion || !ofertaId) return;
    try {
      setEliminando(true);
      const urls = ((ofertaExistente?.oferta_media ?? []) as OfertaMediaRow[]).map((m) => m.url);
      await deleteOferta(ofertaId, urls);
      await invalidarConsultas(ofertaId);
      clearAll();
      showToast("Publicación eliminada correctamente", "success");
      router.replace("/(main)/tabs/ofertas");
    } catch (err: any) {
      console.error("Error al eliminar oferta:", err);
      showToast(err?.message || "No se pudo eliminar la publicación", "error");
    } finally {
      setEliminando(false);
      setConfirmandoEliminar(false);
    }
  };

  // Selección múltiple de imágenes desde la galería
  const pickerFoto = useCallback(async () => {
    if (isMaxReached("foto")) {
      showToast("Máximo " + MAX_IMAGES + " fotos permitidas", "error");
      return;
    }

    try {
      const disponibles = Math.max(1, MAX_IMAGES - fotos.length);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: disponibles,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        addPhotos(
          result.assets.map((asset) => ({
            uri: asset.uri,
            mimeType: asset.mimeType,
          }))
        );
      }
    } catch (err) {
      console.error("Error picking images:", err);
    }
  }, [addPhotos, fotos.length, isMaxReached]);

  // Selección de video con apertura inmediata del modal de vista previa y recorte (<= 20s)
  const pickerVideo = useCallback(async () => {
    if (isMaxReached("video")) {
      showToast("Máximo " + MAX_VIDEOS + " videos permitidos", "error");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: MAX_VIDEO_DURATION,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const rawDur = asset.duration ?? 0;
        const duracionDetectada =
          rawDur > 1000 ? Number((rawDur / 1000).toFixed(1)) : Number(rawDur.toFixed(1));

        setVideoEnEdicion({
          uri: asset.uri,
          mimeType: asset.mimeType,
          duracionInicial: duracionDetectada,
          trimInicio: 0,
          trimFin:
            duracionDetectada > 0
              ? Math.min(duracionDetectada, MAX_VIDEO_DURATION)
              : MAX_VIDEO_DURATION,
        });
      }
    } catch (err) {
      console.error("Error picking video:", err);
    }
  }, [isMaxReached]);

  const handleConfirmVideoTrim = useCallback(
    (res: VideoTrimResult) => {
      if (!videoEnEdicion) return;

      if (videoEnEdicion.id) {
        updateVideo(videoEnEdicion.id, {
          duracion: res.duracion,
          duracionOriginal: res.duracionOriginal,
          trimInicio: res.trimInicio,
          trimFin: res.trimFin,
        });
        showToast(`Recorte actualizado (${res.duracion}s)`, "success");
      } else {
        addVideo(videoEnEdicion.uri, res.duracion, videoEnEdicion.mimeType, {
          duracionOriginal: res.duracionOriginal,
          trimInicio: res.trimInicio,
          trimFin: res.trimFin,
        });
        showToast(`Video agregado (${res.duracion}s)`, "success");
      }

      setVideoEnEdicion(null);
    },
    [addVideo, updateVideo, videoEnEdicion]
  );

  const puedePublicar =
    !!values.categoria &&
    !!values.cantidad &&
    !!values.precio &&
    !!values.tipo_precio &&
    !!values.provincia;

  if (esEdicion && cargandoOferta) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando datos de la publicación...</Text>
      </View>
    );
  }

  if (esEdicion && (errorOferta || !ofertaExistente)) {
    return (
      <View className="flex-1 bg-canvas">
        <MobileTopBar title="Editar oferta" onBack={() => router.back()} />
        <Screen>
          <EmptyState
            icon="alert"
            title="No encontramos la publicación para editar"
            description={
              errorOferta
                ? String((errorOferta as Error).message ?? errorOferta)
                : "Puede que haya sido eliminada."
            }
            action={
              <Button
                label="Volver a mis ofertas"
                icon="arrowLeft"
                onPress={() => router.replace("/(main)/tabs/ofertas")}
              />
            }
          />
        </Screen>
      </View>
    );
  }

  if (esEdicion && user && ofertaExistente && ofertaExistente.productor_id !== user.id) {
    return (
      <View className="flex-1 bg-canvas">
        <MobileTopBar title="Editar oferta" onBack={() => router.back()} />
        <Screen>
          <EmptyState
            icon="lock"
            title="No tenés permiso para editar esta publicación"
            description="Solo el productor que publicó el lote puede modificarlo o eliminarlo."
            action={
              <Button
                label="Volver al detalle"
                icon="arrowLeft"
                onPress={() => router.replace(`/(main)/oferta/${ofertaId}`)}
              />
            }
          />
        </Screen>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar
        title={esEdicion ? "Editar publicación" : "Publicar oferta"}
        onBack={() => router.back()}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Screen
          eyebrow={esEdicion ? "Editar lote" : "Nuevo lote"}
          title={esEdicion ? "Actualizar publicación" : "Publicar oferta"}
          subtitle={
            esEdicion
              ? "Modificá los datos, el estado o las fotos de tu publicación."
              : "Cargá los datos del lote: los compradores y fleteros los ven al instante."
          }
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

                {esEdicion ? (
                  <View className="gap-2 pt-1">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Estado de la publicación
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {ESTADOS_OFERTA.map((item) => {
                        const activo = (values.estado ?? "activa") === item.valor;
                        return (
                          <Pressable
                            key={item.valor}
                            onPress={() => form.setValue("estado", item.valor)}
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
                              {item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </Card>

              <Card className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-wheat-50">
                    <Icon name="image" size={19} className="text-wheat-600" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">Galería de medios</Text>
                    <Text className="text-xs text-ink-muted">
                      Subida múltiple habilitada · Hasta {MAX_IMAGES} fotos y {MAX_VIDEOS} videos de{" "}
                      {MAX_VIDEO_DURATION}s
                    </Text>
                  </View>
                </View>

                <View className="gap-4">
                  <View className="gap-1">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Fotos ({fotos.length}/{MAX_IMAGES})
                    </Text>
                    <Text className="text-xs text-ink-muted">
                      Podés seleccionar varias fotos a la vez. Tocá una foto para usarla de portada
                      en la publicación.
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
                      accessibilityLabel="Añadir fotos"
                      className={[
                        "h-24 w-28 items-center justify-center gap-1 rounded-2xl border border-dashed px-2",
                        isMaxReached("foto")
                          ? "border-line bg-surface-sunk opacity-50"
                          : "border-sage-300 bg-sage-50 active:bg-sage-100",
                      ].join(" ")}
                    >
                      <Icon name="camera" size={20} className="text-sage-600" />
                      <Text className="text-center text-[10px] font-semibold text-sage-700">
                        Elegir fotos ({fotos.length}/{MAX_IMAGES})
                      </Text>
                    </Pressable>
                  </View>

                  <View className="gap-1">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      Videos ({videos.length}/{MAX_VIDEOS} · hasta {MAX_VIDEO_DURATION}s c/u)
                    </Text>
                    <Text className="text-xs text-ink-muted">
                      Al subir un video o tocar &quot;Recortar&quot; se abre la vista previa para
                      ajustar el fragmento de hasta {MAX_VIDEO_DURATION} segundos.
                    </Text>
                    <View className="flex-row flex-wrap gap-3 pt-1">
                      {videos.map((video) => (
                        <VideoGalleryCard
                          key={video.id}
                          video={video}
                          onEdit={() =>
                            setVideoEnEdicion({
                              id: video.id,
                              uri: video.uri,
                              mimeType: video.mimeType,
                              duracionInicial: video.duracionOriginal ?? video.duracion ?? 0,
                              trimInicio: video.trimInicio ?? 0,
                              trimFin:
                                video.trimFin ??
                                (video.duracion && video.duracion > 0
                                  ? (video.trimInicio ?? 0) + video.duracion
                                  : undefined),
                            })
                          }
                          onRemove={() => removeMedia(video.id)}
                        />
                      ))}

                      <Pressable
                        onPress={pickerVideo}
                        disabled={isMaxReached("video")}
                        accessibilityLabel="Añadir video"
                        className={[
                          "h-28 w-40 items-center justify-center gap-1 rounded-2xl border border-dashed px-2",
                          isMaxReached("video")
                            ? "border-line bg-surface-sunk opacity-50"
                            : "border-clay-300 bg-clay-50 active:bg-clay-100",
                        ].join(" ")}
                      >
                        <Icon name="video" size={20} className="text-clay-600" />
                        <Text className="text-center text-[10px] font-semibold text-clay-700">
                          Subir y recortar video ({videos.length}/{MAX_VIDEOS})
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
                  {esEdicion ? (
                    <ResumenFila label="Estado" value={values.estado || "activa"} />
                  ) : null}
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
                    label={esEdicion ? "Guardar cambios" : "Publicar oferta"}
                    icon="checkCircle"
                    size="lg"
                    fullWidth
                    onPress={onSubmit}
                    disabled={!puedePublicar}
                  />
                )}

                <Text className="text-center text-[11px] leading-4 text-ink-muted">
                  {esEdicion
                    ? "Al guardar cambios se actualiza la publicación y se recalculan los cruces con las demandas activas."
                    : "La oferta queda activa durante 30 días y se cruza automáticamente con las demandas del mercado."}
                </Text>

                {Platform.OS === "web" ? (
                  <Text className="text-center text-[11px] text-ink-muted">
                    Ejecutando en navegador (web).
                  </Text>
                ) : null}
              </Card>

              {esEdicion ? (
                <Card className="gap-3 border-clay-200 bg-clay-50/40">
                  <View className="flex-row items-center gap-2">
                    <Icon name="trash" size={16} className="text-clay-600" />
                    <Text className="text-sm font-bold text-ink">Eliminar publicación</Text>
                  </View>
                  <Text className="text-xs leading-4 text-ink-muted">
                    Si retirás el lote del mercado, se eliminará la publicación junto con sus
                    fotos, videos y cruces asociados.
                  </Text>

                  {confirmandoEliminar ? (
                    <View className="gap-2 pt-1">
                      <Text className="text-xs font-semibold text-clay-700">
                        ¿Confirmás que querés eliminar esta publicación definitivamente?
                      </Text>
                      <View className="flex-row gap-2">
                        <Button
                          label="Sí, eliminar"
                          icon="trash"
                          variant="danger"
                          size="sm"
                          loading={eliminando}
                          onPress={onEliminarOferta}
                          className="flex-1"
                        />
                        <Button
                          label="Cancelar"
                          variant="secondary"
                          size="sm"
                          disabled={eliminando}
                          onPress={() => setConfirmandoEliminar(false)}
                          className="flex-1"
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      label="Eliminar publicación"
                      icon="trash"
                      variant="danger"
                      size="md"
                      fullWidth
                      onPress={() => setConfirmandoEliminar(true)}
                    />
                  )}
                </Card>
              ) : null}
            </View>
          </View>
        </Screen>
      </ScrollView>

      {videoEnEdicion ? (
        <VideoTrimModal
          visible={Boolean(videoEnEdicion)}
          uri={videoEnEdicion.uri}
          initialDuracion={videoEnEdicion.duracionInicial}
          initialInicio={videoEnEdicion.trimInicio}
          initialFin={videoEnEdicion.trimFin}
          esEdicionVideo={Boolean(videoEnEdicion.id)}
          onCancel={() => setVideoEnEdicion(null)}
          onConfirm={handleConfirmVideoTrim}
        />
      ) : null}
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
