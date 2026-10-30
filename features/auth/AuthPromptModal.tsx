import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "components/ui/Icon";
import { Button } from "components/ui/Button";
import { Badge } from "components/ui/Card";

export type AuthPromptMotivo = "chat" | "flete";

export interface AuthPromptModalProps {
  visible: boolean;
  onClose: () => void;
  motivo: AuthPromptMotivo;
  returnUrl: string;
  ofertaSummary?: {
    categoria: string;
    raza?: string | null;
    cantidad: number;
    precio: number;
    tipo_precio?: string | null;
  };
}

/**
 * Modal que invita al visitante no registrado o sin sesión a registrarse o iniciar sesión
 * al intentar consultar por chat o pedir flete sobre una publicación pública.
 */
export function AuthPromptModal({
  visible,
  onClose,
  motivo,
  returnUrl,
  ofertaSummary,
}: AuthPromptModalProps) {
  const router = useRouter();

  const esChat = motivo === "chat";

  const onIrARegistro = () => {
    onClose();
    router.push({
      pathname: "/auth",
      params: { mode: "registro", returnUrl },
    });
  };

  const onIrALogin = () => {
    onClose();
    router.push({
      pathname: "/auth",
      params: { mode: "login", returnUrl },
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-ink/75 p-4">
        <Pressable
          onPress={onClose}
          className="absolute inset-0"
          accessibilityLabel="Cerrar modal"
        />

        <View className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-lift">
          {/* Encabezado */}
          <View className="flex-row items-center justify-between border-b border-line-soft px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View
                className={[
                  "h-11 w-11 items-center justify-center rounded-2xl",
                  esChat ? "bg-sage-100" : "bg-clay-100",
                ].join(" ")}
              >
                <Icon
                  name={esChat ? "message" : "truck"}
                  size={20}
                  className={esChat ? "text-sage-700" : "text-clay-700"}
                />
              </View>
              <View className="flex-1 pr-2">
                <Text className="text-base font-bold text-ink">
                  {esChat ? "Consultar por chat" : "Pedir flete"}
                </Text>
                <Text className="text-xs text-ink-muted">
                  {esChat
                    ? "Iniciá sesión para chatear con el vendedor"
                    : "Iniciá sesión para cotizar el transporte"}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft active:bg-surface-sunk"
            >
              <Icon name="x" size={16} className="text-ink-soft" />
            </Pressable>
          </View>

          {/* Cuerpo */}
          <View className="gap-4 p-5">
            {/* Resumen del lote si se proporcionó */}
            {ofertaSummary ? (
              <View className="flex-row items-center justify-between rounded-2xl border border-line-soft bg-surface-soft px-3.5 py-2.5">
                <View className="flex-row items-center gap-2">
                  <Badge tone="sage">{ofertaSummary.categoria.toUpperCase()}</Badge>
                  <Text className="text-xs font-semibold text-ink">
                    {ofertaSummary.cantidad} cabezas
                  </Text>
                </View>
                <Text className="text-xs font-bold text-sage-600">
                  ${Number(ofertaSummary.precio).toLocaleString("es-AR")}
                </Text>
              </View>
            ) : null}

            {/* Mensaje descriptivo */}
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-ink">
                {esChat
                  ? "¿Querés hacer una consulta sobre este lote?"
                  : "¿Querés solicitar transporte para esta hacienda?"}
              </Text>
              <Text className="text-xs leading-5 text-ink-soft">
                {esChat
                  ? "Para comunicarte de forma directa y segura con el productor de este lote, tenés que iniciar sesión o registrarte gratis en Mercado Ganadero."
                  : "Para cotizar el flete y conectar con transportistas de hacienda verificados en tu zona, tenés que iniciar sesión o registrarte gratis."}
              </Text>
            </View>

            {/* Puntos destacados */}
            <View className="gap-2 rounded-2xl bg-sage-50/70 p-3.5">
              <View className="flex-row items-center gap-2.5">
                <Icon name="checkCircle" size={15} className="text-sage-600" />
                <Text className="flex-1 text-xs font-medium text-sage-900">
                  {esChat
                    ? "Canal directo, privado y seguro entre partes"
                    : "Cotizaciones ágiles según origen y destino"}
                </Text>
              </View>
              <View className="flex-row items-center gap-2.5">
                <Icon name="checkCircle" size={15} className="text-sage-600" />
                <Text className="flex-1 text-xs font-medium text-sage-900">
                  {esChat
                    ? "Sin comisiones ocultas ni intermediarios"
                    : "Red de fleteros con experiencia en ganado"}
                </Text>
              </View>
              <View className="flex-row items-center gap-2.5">
                <Icon name="checkCircle" size={15} className="text-sage-600" />
                <Text className="flex-1 text-xs font-medium text-sage-900">
                  Registro 100% gratuito en menos de 1 minuto
                </Text>
              </View>
            </View>

            {/* Botones de acción */}
            <View className="gap-2 pt-1">
              <Button
                label="Registrarme gratis"
                icon="userPlus"
                variant="primary"
                size="md"
                onPress={onIrARegistro}
                fullWidth
              />
              <Button
                label="Ya tengo cuenta · Iniciar sesión"
                icon="logIn"
                variant="secondary"
                size="md"
                onPress={onIrALogin}
                fullWidth
              />
              <Pressable
                onPress={onClose}
                className="items-center py-2 active:opacity-70"
              >
                <Text className="text-xs font-semibold text-ink-muted">
                  Seguir viendo la publicación
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
