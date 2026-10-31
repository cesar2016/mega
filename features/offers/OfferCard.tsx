import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { maskNombreUsuario } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Avatar } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { MediaCover } from "components/ui/MediaCover";
import { fotosDe, portadaDe, videosDe } from "components/ui/OfertaMedia";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";

export type OfertaResumen = {
  id: string;
  productor_id?: string | null;
  categoria: string;
  raza?: string | null;
  cantidad: number;
  peso_promedio?: number | null;
  edad?: string | null;
  precio: number;
  tipo_precio?: string | null;
  descripcion?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  estado?: string | null;
  created_at?: string | null;
  profiles?: { id?: string | null; nombre?: string | null; avatar_url?: string | null } | null;
  oferta_media?: OfertaMediaRow[] | null;
};

const TIPO_PRECIO_LABEL: Record<string, string> = {
  por_kilo: "por kilo",
  por_cabeza: "por cabeza",
  a_convenir: "a convenir",
};

export function formatPrecioOferta(oferta: {
  precio?: number | null;
  tipo_precio?: string | null;
}) {
  if (oferta.tipo_precio === "por_kilo") {
    return `$${Number(oferta.precio).toLocaleString("es-AR")} / kg`;
  }
  if (oferta.tipo_precio === "por_cabeza") {
    return `$${Number(oferta.precio).toLocaleString("es-AR")} / cabeza`;
  }
  return `$${Number(oferta.precio).toLocaleString("es-AR")}`;
}

/**
 * Card de una publicación: muestra la foto de portada, el precio y un resumen
 * del lote. Al tocarla abre el detalle completo, y si se pasan `onEdit` / `onDelete`
 * muestra botones directos para gestionar la publicación.
 */
export function OfferCard({
  oferta,
  onPress,
  onEdit,
  onDelete,
}: {
  oferta: OfertaResumen;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void> | void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [hovered, setHovered] = useState(false);

  const portada = portadaDe(oferta.oferta_media);
  const fotos = fotosDe(oferta.oferta_media).length;
  const videos = videosDe(oferta.oferta_media).length;
  const resumenMedia = [
    fotos > 0 ? `${fotos} foto${fotos === 1 ? "" : "s"}` : "",
    videos > 0 ? `${videos} video${videos === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    try {
      setEliminando(true);
      await onDelete();
    } finally {
      setEliminando(false);
      setConfirmando(false);
    }
  };

  return (
    <View className="w-full">
      <Card
        className={[
          "gap-0 overflow-hidden",
          hovered ? "border-sage-300 shadow-card" : "",
        ].join(" ")}
        padded={false}
      >
        <Pressable
          onPress={onPress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          accessibilityRole="button"
          accessibilityLabel={`Ver publicación de ${oferta.categoria}`}
          className="w-full active:opacity-90"
        >
          {/* Portada */}
          <View className="relative">
            <MediaCover
              url={portada?.url}
              media={oferta.oferta_media}
              hovered={hovered}
              categoria={oferta.categoria}
              className="h-40"
              rounded="rounded-none"
            />

            {fotos > 1 || videos > 0 ? (
              <View
                pointerEvents="none"
                className="absolute bottom-2 right-2 flex-row items-center gap-1 rounded-lg bg-ink/65 px-2 py-1"
              >
                <Icon
                  name={videos > 0 ? "video" : "image"}
                  size={12}
                  className="text-white"
                />
                <Text className="text-[10px] font-semibold text-white">
                  {hovered && videos > 0 ? "Reproduciendo video" : resumenMedia}
                </Text>
              </View>
            ) : null}

            {oferta.estado && oferta.estado !== "activa" ? (
              <View className="absolute left-2 top-2 rounded-lg bg-ink/70 px-2 py-1">
                <Text className="text-[10px] font-semibold uppercase text-white">
                  {oferta.estado}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Contenido */}
          <View className="gap-4 p-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-2">
                <Badge tone="sage" icon="beef">
                  {oferta.categoria?.toUpperCase() ?? "LOTE"}
                </Badge>
                <Text className="text-lg font-bold leading-6 text-ink" numberOfLines={2}>
                  {oferta.raza || "Lote de hacienda"}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xl font-extrabold tracking-tight text-sage-600">
                  {formatPrecioOferta(oferta)}
                </Text>
                {oferta.tipo_precio && oferta.tipo_precio !== "a_convenir" ? (
                  <Text className="text-[11px] uppercase tracking-wide text-ink-muted">
                    {TIPO_PRECIO_LABEL[oferta.tipo_precio] ?? oferta.tipo_precio}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                <Icon name="boxes" size={14} className="text-ink-muted" />
                <Text className="text-xs font-semibold text-ink-soft">
                  {oferta.cantidad} cab.
                </Text>
              </View>
              {oferta.peso_promedio ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="scale" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    {oferta.peso_promedio} kg
                  </Text>
                </View>
              ) : null}
              {oferta.provincia ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="mapPin" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft" numberOfLines={1}>
                    {oferta.localidad ? `${oferta.localidad}, ` : ""}
                    {oferta.provincia}
                  </Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center gap-2.5 border-t border-line-soft pt-3">
              <Avatar
                uri={null}
                nombre={maskNombreUsuario(
                  oferta.profiles?.nombre,
                  "Usu****",
                  Boolean(onEdit || onDelete)
                )}
                size={32}
              />
              <Text className="flex-1 text-xs font-medium text-ink-soft" numberOfLines={1}>
                {maskNombreUsuario(
                  oferta.profiles?.nombre,
                  "Usu****",
                  Boolean(onEdit || onDelete)
                )}
              </Text>
              <View className="flex-row items-center gap-1 text-sage-600">
                <Text className="text-xs font-bold">Ver publicación</Text>
                <Icon name="chevronRight" size={14} className="text-sage-600" />
              </View>
            </View>
          </View>
        </Pressable>

        {onEdit || onDelete ? (
          <View className="border-t border-line-soft bg-surface-soft/60 px-5 py-3">
            {confirmando ? (
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-xs font-semibold text-clay-700">
                  ¿Eliminar esta publicación?
                </Text>
                <Button
                  label="Sí, eliminar"
                  icon="trash"
                  variant="danger"
                  size="sm"
                  loading={eliminando}
                  onPress={handleConfirmDelete}
                />
                <Button
                  label="Cancelar"
                  variant="secondary"
                  size="sm"
                  disabled={eliminando}
                  onPress={() => setConfirmando(false)}
                />
              </View>
            ) : (
              <View className="flex-row items-center justify-end gap-2">
                {onEdit ? (
                  <Button
                    label="Editar"
                    icon="pencil"
                    variant="soft"
                    size="sm"
                    onPress={onEdit}
                    className="flex-1"
                  />
                ) : null}
                {onDelete ? (
                  <Button
                    label="Eliminar"
                    icon="trash"
                    variant="danger"
                    size="sm"
                    onPress={() => setConfirmando(true)}
                    className="flex-1"
                  />
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </Card>
    </View>
  );
}

