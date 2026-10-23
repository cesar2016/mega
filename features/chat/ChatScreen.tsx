import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  enviarMensaje,
  useConversaciones,
  useMensajes,
} from "lib/hooks/useChat";
import type { ConversacionResumen } from "lib/hooks/useChat";
import { detectarDatosContacto } from "lib/contactFilter";
import { useResponsive } from "lib/hooks/useResponsive";
import { isSupabaseConfigured } from "lib/supabase";
import { showToast } from "lib/utils";
import { useAuthStore } from "store/authStore";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";

const CONSULTAS_RAPIDAS = [
  "¿Sigue disponible el lote?",
  "¿Cuál es el estado sanitario y vacunación?",
  "¿Qué condición de pago y pesada manejan?",
  "¿Cuentan con balanza y cargadero en el campo?",
];

function formatearHora(iso?: string | null): string {
  if (!iso) return "";
  try {
    const fecha = new Date(iso);
    return fecha.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function resumenContexto(conv: ConversacionResumen): string {
  if (conv.ofertas) {
    const o = conv.ofertas;
    return [
      `${o.cantidad} ${o.categoria}`,
      o.raza,
      o.localidad || o.provincia,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (conv.demandas) {
    const d = conv.demandas;
    return [
      `Demanda: ${d.categoria}`,
      d.raza,
      d.localidad || d.provincia,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return "Consulta general del mercado";
}

export default function ChatScreen() {
  const { id: paramConvId } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isWide } = useResponsive();
  const user = useAuthStore((state) => state.user);

  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(
    paramConvId ? String(paramConvId) : null
  );
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const {
    data: conversacionesData,
    isLoading: cargandoConvs,
    refetch: refetchConvs,
  } = useConversaciones({ enabled: Boolean(user?.id) });

  const conversaciones = useMemo(
    () => conversacionesData ?? [],
    [conversacionesData]
  );

  useEffect(() => {
    if (paramConvId) {
      setSeleccionadaId(String(paramConvId));
    } else if (isWide && !seleccionadaId && conversaciones.length > 0) {
      setSeleccionadaId(conversaciones[0].id);
    }
  }, [paramConvId, isWide, seleccionadaId, conversaciones]);

  const conversacionActiva = useMemo(
    () => conversaciones.find((c) => c.id === seleccionadaId) ?? null,
    [conversaciones, seleccionadaId]
  );

  const { data: mensajesData, isLoading: cargandoMensajes } = useMensajes(
    conversacionActiva?.id ?? seleccionadaId
  );

  const mensajes = useMemo(() => mensajesData ?? [], [mensajesData]);

  useEffect(() => {
    if (mensajes.length > 0) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mensajes.length, seleccionadaId]);

  const validacionContacto = useMemo(
    () => detectarDatosContacto(texto),
    [texto]
  );

  const handleEnviar = async (mensajeExplicito?: string) => {
    const cuerpo = (mensajeExplicito ?? texto).trim();
    const convId = conversacionActiva?.id ?? seleccionadaId;
    if (!cuerpo || !convId || !user?.id) return;

    const control = detectarDatosContacto(cuerpo);
    if (control.bloqueado) {
      showToast(
        control.motivo ?? "No se permite enviar datos de contacto.",
        "error"
      );
      return;
    }

    try {
      setEnviando(true);
      await enviarMensaje({
        conversacionId: convId,
        remitenteId: user.id,
        cuerpo,
      });
      if (!mensajeExplicito) {
        setTexto("");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mensajes", convId] }),
        queryClient.invalidateQueries({ queryKey: ["conversaciones"] }),
      ]);
    } catch (err: any) {
      showToast(
        err?.message || "No se pudo enviar el mensaje.",
        "error"
      );
    } finally {
      setEnviando(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <View className="flex-1 bg-canvas">
        <MobileTopBar title="Chat" />
        <Screen
          eyebrow="Canal protegido"
          title="Consultas y negociaciones"
          subtitle="Comunicate sin revelar tu identidad ni datos de contacto personal."
        >
          <EmptyState
            icon="cloudOff"
            title="Modo demo: sin chat en vivo"
            description="Configurá las variables EXPO_PUBLIC_SUPABASE_* en .env para habilitar el chat interno."
          />
        </Screen>
      </View>
    );
  }

  if (cargandoConvs) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando conversaciones...</Text>
      </View>
    );
  }

  const mostrarLista = isWide || !seleccionadaId;
  const mostrarHilo = isWide || Boolean(seleccionadaId);

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar
        title={
          !isWide && conversacionActiva
            ? `Chat con ${conversacionActiva.contraparte_alias}`
            : "Chat interno"
        }
        onBack={!isWide && seleccionadaId ? () => setSeleccionadaId(null) : undefined}
      />

      <Screen
        eyebrow="Identidad protegida"
        title="Consultas y negociaciones"
        subtitle="Realizá consultas sobre lotes y demandas sin exponer tu nombre real, teléfono ni correo electrónico."
        onRefresh={() => refetchConvs()}
      >
        {/* Banner de seguridad anti-fuga de contacto */}
        <Gradient
          colors={["#E4EDE5", "#F8E6DA"]}
          className="flex-row items-center gap-3.5 rounded-3xl border border-line-soft px-4 py-3.5"
        >
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface/90">
            <Icon name="shield" size={18} className="text-sage-600" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-xs font-bold text-ink">
              Seguridad activa: prohibido pasar datos de contacto
            </Text>
            <Text className="text-xs leading-4 text-ink-soft">
              Ambas partes operan bajo alias encriptado (ej.{" "}
              <Text className="font-bold">Ces****</Text>). El sistema bloquea
              automáticamente teléfonos, emails, WhatsApp, redes sociales y
              enlaces externos.
            </Text>
          </View>
        </Gradient>

        {conversaciones.length === 0 && !seleccionadaId ? (
          <EmptyState
            icon="message"
            title="Todavía no tenés conversaciones activas"
            description="Entrá a cualquier publicación del mercado o a tus cruces en Matches y tocá «Consultar por chat» para iniciar una conversación protegida."
            action={
              <Button
                label="Explorar publicaciones"
                icon="store"
                onPress={() => router.push("/(main)/tabs/feed")}
              />
            }
          />
        ) : (
          <View className="flex-col gap-4 lg:flex-row lg:items-start">
            {/* Columna izquierda: listado de conversaciones */}
            {mostrarLista ? (
              <Card
                padded={false}
                className="w-full overflow-hidden lg:w-80 lg:shrink-0"
              >
                <View className="border-b border-line-soft bg-surface-soft/60 px-4 py-3">
                  <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Conversaciones ({conversaciones.length})
                  </Text>
                </View>

                <View className="divide-y divide-line-soft">
                  {conversaciones.map((conv) => {
                    const activa = conv.id === seleccionadaId;
                    return (
                      <Pressable
                        key={conv.id}
                        onPress={() => setSeleccionadaId(conv.id)}
                        className={[
                          "flex-row items-center gap-3 px-4 py-3.5",
                          activa ? "bg-sage-50" : "active:bg-surface-sunk",
                        ].join(" ")}
                      >
                        <Avatar
                          uri={null}
                          nombre={conv.contraparte_alias}
                          size={40}
                        />
                        <View className="min-w-0 flex-1 gap-0.5">
                          <View className="flex-row items-center justify-between gap-2">
                            <Text
                              className="text-sm font-bold text-ink"
                              numberOfLines={1}
                            >
                              {conv.contraparte_alias}
                            </Text>
                            {conv.ultimo_mensaje?.creado_en ? (
                              <Text className="text-[10px] text-ink-muted">
                                {formatearHora(conv.ultimo_mensaje.creado_en)}
                              </Text>
                            ) : null}
                          </View>
                          <Text
                            className="text-[11px] font-semibold text-sage-700"
                            numberOfLines={1}
                          >
                            {resumenContexto(conv)}
                          </Text>
                          <Text
                            className="text-xs text-ink-muted"
                            numberOfLines={1}
                          >
                            {conv.ultimo_mensaje?.cuerpo ??
                              "Sin mensajes todavía — enviá tu consulta"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ) : null}

            {/* Columna derecha: hilo de mensajes */}
            {mostrarHilo ? (
              <Card
                padded={false}
                className="w-full flex-1 overflow-hidden"
              >
                {conversacionActiva || seleccionadaId ? (
                  <View className="flex-col">
                    {/* Cabecera de la conversación */}
                    <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-surface-soft/50 px-5 py-3.5">
                      <View className="flex-row items-center gap-3">
                        {!isWide ? (
                          <Pressable
                            onPress={() => setSeleccionadaId(null)}
                            className="h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface"
                          >
                            <Icon
                              name="arrowLeft"
                              size={16}
                              className="text-ink"
                            />
                          </Pressable>
                        ) : null}
                        <Avatar
                          uri={null}
                          nombre={
                            conversacionActiva?.contraparte_alias ?? "Usu****"
                          }
                          size={38}
                        />
                        <View className="gap-0.5">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-sm font-bold text-ink">
                              {conversacionActiva?.contraparte_alias ??
                                "Usu****"}
                            </Text>
                            <Badge tone="sage" icon="lock">
                              Anonimizado
                            </Badge>
                          </View>
                          <Text className="text-xs text-ink-muted">
                            {conversacionActiva
                              ? resumenContexto(conversacionActiva)
                              : "Conversación protegida"}
                          </Text>
                        </View>
                      </View>

                      {conversacionActiva?.oferta_id ? (
                        <Button
                          label="Ver publicación"
                          icon="eye"
                          variant="secondary"
                          size="sm"
                          onPress={() =>
                            router.push(
                              `/(main)/oferta/${conversacionActiva.oferta_id}`
                            )
                          }
                        />
                      ) : null}
                    </View>

                    {/* Mensajes */}
                    <ScrollView
                      ref={scrollRef}
                      className="h-[360px] bg-canvas/50 px-4 py-4"
                      contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
                    >
                      {cargandoMensajes ? (
                        <View className="py-12 items-center justify-center gap-2">
                          <ActivityIndicator
                            size="small"
                            className="text-sage-500"
                          />
                          <Text className="text-xs text-ink-muted">
                            Cargando mensajes...
                          </Text>
                        </View>
                      ) : mensajes.length === 0 ? (
                        <View className="items-center justify-center gap-2 py-10 px-4">
                          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-sage-50">
                            <Icon
                              name="message"
                              size={20}
                              className="text-sage-600"
                            />
                          </View>
                          <Text className="text-center text-sm font-bold text-ink">
                            Iniciá la consulta con{" "}
                            {conversacionActiva?.contraparte_alias ??
                              "la contraparte"}
                          </Text>
                          <Text className="max-w-md text-center text-xs leading-5 text-ink-muted">
                            Hacé todas las preguntas que necesites sobre la
                            hacienda, sanidad, pesada o condiciones comerciales
                            sin compartir datos de contacto personal.
                          </Text>
                        </View>
                      ) : (
                        mensajes.map((msg) => {
                          const esMio = msg.remitente_id === user?.id;
                          return (
                            <View
                              key={msg.id}
                              className={[
                                "max-w-[82%] rounded-2xl px-3.5 py-2.5",
                                esMio
                                  ? "self-end bg-sage-600"
                                  : "self-start border border-line-soft bg-surface",
                              ].join(" ")}
                            >
                              {!esMio ? (
                                <Text className="mb-0.5 text-[10px] font-bold text-sage-700">
                                  {conversacionActiva?.contraparte_alias ??
                                    "Usu****"}
                                </Text>
                              ) : null}
                              <Text
                                className={[
                                  "text-sm leading-5",
                                  esMio ? "text-white" : "text-ink",
                                ].join(" ")}
                              >
                                {msg.cuerpo}
                              </Text>
                              <Text
                                className={[
                                  "mt-1 self-end text-[10px]",
                                  esMio ? "text-white/75" : "text-ink-muted",
                                ].join(" ")}
                              >
                                {formatearHora(msg.creado_en)}
                              </Text>
                            </View>
                          );
                        })
                      )}
                    </ScrollView>

                    {/* Consultas rápidas sugeridas */}
                    <View className="border-t border-line-soft bg-surface-soft/40 px-4 py-2.5">
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {CONSULTAS_RAPIDAS.map((pregunta) => (
                          <Pressable
                            key={pregunta}
                            disabled={enviando}
                            onPress={() => handleEnviar(pregunta)}
                            className="rounded-full border border-line bg-surface px-3 py-1.5 active:bg-sage-50"
                          >
                            <Text className="text-xs font-medium text-ink-soft">
                              {pregunta}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>

                    {/* Alerta en vivo si el usuario intenta escribir datos de contacto */}
                    {validacionContacto.bloqueado ? (
                      <View className="flex-row items-center gap-2 border-t border-clay-200 bg-clay-50 px-4 py-2.5">
                        <Icon
                          name="ban"
                          size={15}
                          className="text-clay-600"
                        />
                        <Text className="flex-1 text-xs font-semibold text-clay-700">
                          {validacionContacto.motivo}
                        </Text>
                      </View>
                    ) : null}

                    {/* Caja de escritura */}
                    <View className="flex-row items-center gap-2.5 border-t border-line-soft bg-surface p-3.5">
                      <TextInput
                        value={texto}
                        onChangeText={setTexto}
                        placeholder="Escribí tu consulta (sin teléfonos, emails ni redes)..."
                        placeholderTextColor="#7A867E"
                        multiline
                        maxLength={500}
                        onSubmitEditing={() => {
                          if (!validacionContacto.bloqueado && texto.trim()) {
                            handleEnviar();
                          }
                        }}
                        className="max-h-24 min-h-[42px] flex-1 rounded-2xl border border-line bg-surface-soft px-3.5 py-2.5 text-sm text-ink"
                      />
                      <Button
                        label="Enviar"
                        icon="arrowRight"
                        onPress={() => handleEnviar()}
                        loading={enviando}
                        disabled={
                          enviando ||
                          !texto.trim() ||
                          validacionContacto.bloqueado
                        }
                      />
                    </View>
                  </View>
                ) : (
                  <View className="items-center justify-center py-16 px-6">
                    <Text className="text-sm text-ink-muted">
                      Seleccioná una conversación para ver los mensajes.
                    </Text>
                  </View>
                )}
              </Card>
            ) : null}
          </View>
        )}
      </Screen>
    </View>
  );
}
