import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import type { InteraccionUsuarioRow } from "lib/hooks/useOfertaInteracciones";
import { Icon } from "components/ui/Icon";
import { Avatar } from "components/ui/Avatar";
import { Badge } from "components/ui/Card";
import { Button } from "components/ui/Button";

function formatearFechaHora(iso?: string | null): string {
  if (!iso) return "";
  try {
    const fecha = new Date(iso);
    return fecha.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function InteraccionesOfertaModal({
  visible,
  onClose,
  initialTab = "likes",
  likes,
  visitas,
  tituloOferta,
}: {
  visible: boolean;
  onClose: () => void;
  initialTab?: "likes" | "visitas";
  likes: InteraccionUsuarioRow[];
  visitas: InteraccionUsuarioRow[];
  tituloOferta?: string;
}) {
  const [tab, setTab] = useState<"likes" | "visitas">(initialTab);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
    }
  }, [visible, initialTab]);

  const items = tab === "likes" ? likes : visitas;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-ink/60 p-4"
      >
        <Pressable
          onPress={(e) => (e as any)?.stopPropagation?.()}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-line-soft bg-surface shadow-card"
        >
          {/* Cabecera */}
          <View className="flex-row items-center justify-between border-b border-line-soft px-5 py-4">
            <View className="flex-1 pr-3">
              <Text className="text-base font-extrabold text-ink">
                Actividad de la publicación
              </Text>
              {tituloOferta ? (
                <Text className="text-xs text-ink-muted" numberOfLines={1}>
                  {tituloOferta}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar modal"
              className="h-8 w-8 items-center justify-center rounded-full bg-surface-soft active:bg-surface-sunk"
            >
              <Icon name="x" size={16} className="text-ink-soft" />
            </Pressable>
          </View>

          {/* Selector de pestañas: Me gusta / Visitas */}
          <View className="flex-row gap-2 border-b border-line-soft bg-surface-soft/50 px-5 py-3">
            <Pressable
              onPress={() => setTab("likes")}
              className={[
                "flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-2.5 px-3",
                tab === "likes"
                  ? "bg-red-600 shadow-xs"
                  : "bg-surface border border-line-soft",
              ].join(" ")}
            >
              <Icon
                name="heart"
                size={15}
                color={tab === "likes" ? "#FFFFFF" : "#DC2626"}
                fill={tab === "likes" ? "#FFFFFF" : "#DC2626"}
                className={tab === "likes" ? "text-white" : "text-red-600"}
              />
              <Text
                className={[
                  "text-xs font-bold",
                  tab === "likes" ? "text-white" : "text-ink-soft",
                ].join(" ")}
              >
                Me gusta ({likes.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTab("visitas")}
              className={[
                "flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-2.5 px-3",
                tab === "visitas"
                  ? "bg-sage-600 shadow-xs"
                  : "bg-surface border border-line-soft",
              ].join(" ")}
            >
              <Icon
                name="eye"
                size={15}
                className={tab === "visitas" ? "text-white" : "text-sage-600"}
              />
              <Text
                className={[
                  "text-xs font-bold",
                  tab === "visitas" ? "text-white" : "text-ink-soft",
                ].join(" ")}
              >
                Visitas ({visitas.length})
              </Text>
            </Pressable>
          </View>

          {tab === "visitas" ? (
            <View className="flex-row items-center gap-2 bg-sage-50/70 px-5 py-2 border-b border-line-soft">
              <Icon name="info" size={13} className="text-sage-700" />
              <Text className="flex-1 text-[11px] text-sage-800">
                Se contabilizan visitas válidas con permanencia mayor a 30 segundos en el lote.
              </Text>
            </View>
          ) : null}

          {/* Listado */}
          <ScrollView className="max-h-80 px-5 py-3">
            {items.length === 0 ? (
              <View className="items-center justify-center gap-2 py-8">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-surface-soft">
                  <Icon
                    name={tab === "likes" ? "heart" : "eye"}
                    size={20}
                    className="text-ink-muted"
                  />
                </View>
                <Text className="text-sm font-bold text-ink">
                  {tab === "likes"
                    ? "Todavía no hay Me gusta"
                    : "Todavía no se registraron visitas (+30s)"}
                </Text>
                <Text className="text-center text-xs text-ink-muted">
                  {tab === "likes"
                    ? "Sé el primero en marcar este lote como favorito."
                    : "Las visitas se registran cuando alguien permanece más de 30 segundos viendo el lote."}
                </Text>
              </View>
            ) : (
              <View className="gap-2.5 py-1">
                {items.map((item) => {
                  const nombreRegistrado = item.profiles?.nombre?.trim();
                  const esRegistrado = Boolean(item.user_id && nombreRegistrado);
                  const nombreMostrar = esRegistrado ? nombreRegistrado! : "Visitante";

                  return (
                    <View
                      key={item.id}
                      className="flex-row items-center justify-between gap-3 rounded-2xl border border-line-soft bg-surface-soft/60 px-3.5 py-2.5"
                    >
                      <View className="flex-row items-center gap-3 flex-1 min-w-0">
                        <Avatar
                          uri={esRegistrado ? item.profiles?.avatar_url : null}
                          nombre={nombreMostrar}
                          size={36}
                        />
                        <View className="flex-1 min-w-0">
                          <Text
                            className="text-sm font-bold text-ink"
                            numberOfLines={1}
                          >
                            {nombreMostrar}
                          </Text>
                          <Text className="text-[11px] text-ink-muted">
                            {formatearFechaHora(item.created_at)}
                          </Text>
                        </View>
                      </View>

                      <Badge tone={esRegistrado ? "sage" : "neutral"}>
                        {esRegistrado ? "Usuario" : "Visitante"}
                      </Badge>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View className="border-t border-line-soft bg-surface px-5 py-3.5">
            <Button
              label="Cerrar"
              variant="secondary"
              size="sm"
              onPress={onClose}
              fullWidth
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
