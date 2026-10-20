import React from "react";
import { Text, View } from "react-native";
import { Icon } from "components/ui/Icon";
import { Card } from "components/ui/Card";
import { EmptyState } from "components/ui/Avatar";
import { Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";

const PASOS = [
  {
    icon: "handshake" as const,
    titulo: "Aceptás un match",
    texto: "El matching cruza tu búsqueda con los lotes y te propone los mejores.",
  },
  {
    icon: "message" as const,
    titulo: "Arrancá la conversación",
    texto: "Coordiná precio, entrega y condiciones directamente con la contraparte.",
  },
  {
    icon: "truck" as const,
    titulo: "Resolvés el flete",
    texto: "Los transportistas disponibles en tu zona reciben la solicitud de carga.",
  },
];

/**
 * Mensajería entre productor y comprador. Pantalla placeholder: el modelo de
 * datos (`conversaciones`, `mensajes`) existe, el flujo de Realtime no.
 */
export default function ChatScreen() {
  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Chat" />

      <Screen
        eyebrow="Negociaciones"
        title="Conversaciones"
        subtitle="Acá van las conversaciones con compradores y productores una vez que aceptan un match."
      >
        <EmptyState
          icon="message"
          title="Todavía no tenés conversaciones"
          description="Cuando aceptás un match, la conversación con la otra parte aparece acá y podés coordinar la operación."
        />

        <View className="gap-3">
          <Text className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
            Cómo funciona
          </Text>
          {PASOS.map((paso, index) => (
            <Card key={paso.titulo} className="flex-row items-start gap-4">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-sage-50">
                <Icon name={paso.icon} size={19} className="text-sage-600" />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-bold text-ink">
                  {index + 1}. {paso.titulo}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted">{paso.texto}</Text>
              </View>
            </Card>
          ))}
        </View>
      </Screen>
    </View>
  );
}
