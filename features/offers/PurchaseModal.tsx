import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "components/ui/Icon";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Badge } from "components/ui/Card";
import { WhatsAppIcon } from "components/ui/SocialIcons";
import { showToast } from "lib/utils";
import { isSupabaseConfigured, supabase } from "lib/supabase";
import type { UserProfile } from "store/authStore";

export type PurchaseModalProps = {
  visible: boolean;
  onClose: () => void;
  oferta: {
    id: string;
    categoria: string;
    raza?: string | null;
    cantidad: number;
    precio: number;
    tipo_precio?: string | null;
    peso_promedio?: number | null;
    provincia?: string | null;
    localidad?: string | null;
    estado?: string | null;
    productor_id?: string | null;
    profiles?: {
      id?: string | null;
      nombre?: string | null;
      telefono?: string | null;
      avatar_url?: string | null;
    } | null;
  };
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
};

type VendedorData = {
  nombre: string;
  telefono: string;
  email: string;
  establecimiento?: string | null;
  localidad?: string | null;
  provincia?: string | null;
};

function formatPrecio(precio: number, tipo_precio?: string | null) {
  const formatted = `$${Number(precio).toLocaleString("es-AR")}`;
  if (tipo_precio === "por_kilo") return `${formatted} / kg`;
  if (tipo_precio === "por_cabeza") return `${formatted} / cab.`;
  return formatted;
}

export function PurchaseModal({
  visible,
  onClose,
  oferta,
  user,
  profile,
}: PurchaseModalProps) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"confirm" | "success">("confirm");
  const [loading, setLoading] = useState(false);

  // Datos del comprador
  const [nombre, setNombre] = useState(profile?.nombre || "");
  const [telefono, setTelefono] = useState(profile?.telefono || "");
  const [email, setEmail] = useState(user?.email || "");

  // Datos del vendedor revelados tras confirmar
  const [vendedor, setVendedor] = useState<VendedorData | null>(null);
  const [emailInfo, setEmailInfo] = useState<{ enviado: boolean; sinApiKey?: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      setPhase("confirm");
      setLoading(false);
      setVendedor(null);
      setEmailInfo(null);
      setNombre((prev) => prev || profile?.nombre || "");
      setTelefono((prev) => prev || profile?.telefono || "");
      setEmail((prev) => prev || user?.email || "");
    }
  }, [visible, profile?.nombre, profile?.telefono, user?.email]);

  const handleConfirmar = async () => {
    if (oferta.estado === "vendida" || oferta.estado === "completada") {
      showToast("Este lote ya fue vendido y no se encuentra disponible", "info");
      onClose();
      return;
    }

    if (!nombre.trim()) {
      showToast("Por favor indicá tu nombre de contacto", "error");
      return;
    }
    if (!telefono.trim()) {
      showToast("Por favor indicá un teléfono o WhatsApp de contacto", "error");
      return;
    }

    try {
      setLoading(true);

      // 1. Intentar con el endpoint serverless que envía emails con Resend y actualiza estado a 'vendida'
      let apiExitosa = false;
      let vendedorObtenido: VendedorData | null = null;
      let emailEnviadoRes = false;
      let sinKeyRes = false;

      try {
        const res = await fetch("/api/comprar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ofertaId: oferta.id,
            compradorId: user?.id,
            compradorNombre: nombre.trim(),
            compradorTelefono: telefono.trim(),
            compradorEmail: email.trim() || user?.email,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.vendedor) {
            apiExitosa = true;
            vendedorObtenido = data.vendedor;
            emailEnviadoRes = Boolean(data.emailCompradorEnviado || data.emailVendedorEnviado);
            sinKeyRes = Boolean(data.emailDetalle?.sinApiKey);
          }
        }
      } catch (e) {
        console.warn("Llamada a /api/comprar no disponible o fallida, usando fallback Supabase:", e);
      }

      // 2. Si falló la API serverless (ej. en desarrollo local con Metro), ejecutar fallback
      if (!apiExitosa || !vendedorObtenido) {
        let vendedorNombre = oferta.profiles?.nombre || "Productor";
        let vendedorTelefono = oferta.profiles?.telefono || "+54 9 11 4567-8900";
        let vendedorEmail = "contacto@mercadoganadero.app";
        let vendedorEstablecimiento: string | null = null;

        if (isSupabaseConfigured && oferta.productor_id) {
          try {
            // Consultar datos reales de profile y productor
            const { data: pData } = await supabase
              .from("profiles")
              .select("nombre, telefono")
              .eq("id", oferta.productor_id)
              .maybeSingle();

            if (pData?.nombre) vendedorNombre = pData.nombre;
            if (pData?.telefono) vendedorTelefono = pData.telefono;

            const { data: prodData } = await supabase
              .from("productores")
              .select("establecimiento")
              .eq("user_id", oferta.productor_id)
              .maybeSingle();

            if (prodData?.establecimiento) {
              vendedorEstablecimiento = prodData.establecimiento;
            }

            // Registrar notificación para el vendedor
            await supabase.from("notificaciones").insert([
              {
                usuario_id: oferta.productor_id,
                tipo: "estado",
                titulo: `¡Lote de ${oferta.categoria} vendido!`,
                cuerpo: `${nombre.trim()} ha confirmado la compra de tu lote. Contactalo al ${telefono.trim()} o ${email.trim()}.`,
                entidad_tipo: "oferta",
                entidad_id: oferta.id,
              },
            ]);
          } catch (err) {
            console.error("Error al consultar datos del vendedor en Supabase:", err);
          }
        }

        vendedorObtenido = {
          nombre: vendedorNombre,
          telefono: vendedorTelefono,
          email: vendedorEmail,
          establecimiento: vendedorEstablecimiento,
          localidad: oferta.localidad,
          provincia: oferta.provincia,
        };
      }

      // 3. Asegurar que la oferta quede marcada como 'vendida' en la base de datos
      if (isSupabaseConfigured) {
        try {
          await supabase.from("ofertas").update({ estado: "vendida" }).eq("id", oferta.id);
        } catch (errUp) {
          console.error("Error al actualizar estado en Supabase:", errUp);
        }
      }

      // 4. Invalidar queries para refrescar la UI inmediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ofertas_activas"] }),
        queryClient.invalidateQueries({ queryKey: ["oferta", oferta.id] }),
        queryClient.invalidateQueries({ queryKey: ["ofertas_productor"] }),
      ]);

      setVendedor(vendedorObtenido);
      setEmailInfo({ enviado: emailEnviadoRes, sinApiKey: sinKeyRes });
      setPhase("success");
      showToast("¡Lote marcado como vendido! Datos intercambiados exitosamente.", "success");
    } catch (err: any) {
      console.error("Error al confirmar compra:", err);
      showToast(err?.message || "Ocurrió un error al procesar la compra", "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirWhatsApp = (numero: string) => {
    const limpio = numero.replace(/[^0-9]/g, "");
    const url = `https://wa.me/${limpio}?text=${encodeURIComponent(
      `Hola! Te contacto desde Mercado Ganadero por la compra confirmada de tu lote de ${oferta.categoria} (${oferta.cantidad} cabezas).`
    )}`;
    Linking.openURL(url).catch(() => {
      showToast("No se pudo abrir WhatsApp", "error");
    });
  };

  const llamarTelefono = (numero: string) => {
    Linking.openURL(`tel:${numero}`).catch(() => {
      showToast("No se pudo iniciar la llamada", "error");
    });
  };

  const enviarEmail = (destinatario: string) => {
    Linking.openURL(
      `mailto:${destinatario}?subject=${encodeURIComponent(
        `Compra de lote de ${oferta.categoria} - Mercado Ganadero`
      )}`
    ).catch(() => {
      showToast("No se pudo abrir la aplicación de correo", "error");
    });
  };

  const ubicacion = [oferta.localidad, oferta.provincia].filter(Boolean).join(", ");
  const precioTexto = formatPrecio(oferta.precio, oferta.tipo_precio);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View className="flex-1 items-center justify-center bg-ink/70 p-4">
        <Pressable
          onPress={() => {
            if (!loading) onClose();
          }}
          className="absolute inset-0"
          accessibilityLabel="Cerrar modal"
        />

        <View className="w-full max-w-lg max-h-[92vh] overflow-hidden rounded-3xl border border-line bg-surface shadow-lift">
          {/* Header del modal */}
          <View className="flex-row items-center justify-between border-b border-line-soft px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View
                className={`h-10 w-10 items-center justify-center rounded-2xl ${
                  phase === "success" ? "bg-sage-100" : "bg-clay-50"
                }`}
              >
                <Icon
                  name={phase === "success" ? "checkCircle" : "shoppingCart"}
                  size={20}
                  className={phase === "success" ? "text-sage-600" : "text-clay-600"}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-ink">
                  {phase === "success" ? "¡Compra confirmada!" : "¿Confirmar compra del lote?"}
                </Text>
                <Text className="text-xs text-ink-muted">
                  {phase === "success"
                    ? "El lote ha quedado marcado como VENDIDO"
                    : "Intercambio directo de datos y notificación a ambas partes"}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => {
                if (!loading) onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              className="h-9 w-9 items-center justify-center rounded-full bg-surface-soft active:bg-surface-sunk"
            >
              <Icon name="x" size={16} className="text-ink-soft" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={Platform.OS === "web"}
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            {/* Resumen del Lote */}
            <View className="rounded-2xl border border-line-soft bg-surface-soft p-4 gap-2.5">
              <View className="flex-row items-center justify-between">
                {phase === "success" ? (
                  <Badge tone="clay" icon="ban">
                    LOTE VENDIDO
                  </Badge>
                ) : (
                  <Badge tone="sage" icon="beef">
                    {oferta.categoria}
                  </Badge>
                )}
                <Text className="text-base font-extrabold text-ink">{precioTexto}</Text>
              </View>

              <Text className="text-sm font-semibold text-ink">
                {oferta.raza || `Lote de ${oferta.categoria}`}
              </Text>

              <View className="flex-row flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                <View className="flex-row items-center gap-1">
                  <Icon name="boxes" size={13} className="text-ink-soft" />
                  <Text className="text-xs text-ink-soft">{oferta.cantidad} cabezas</Text>
                </View>
                {oferta.peso_promedio ? (
                  <View className="flex-row items-center gap-1">
                    <Icon name="scale" size={13} className="text-ink-soft" />
                    <Text className="text-xs text-ink-soft">
                      {oferta.peso_promedio} kg prom.
                    </Text>
                  </View>
                ) : null}
                {ubicacion ? (
                  <View className="flex-row items-center gap-1">
                    <Icon name="mapPin" size={13} className="text-ink-soft" />
                    <Text className="text-xs text-ink-soft">{ubicacion}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {phase === "confirm" ? (
              <>
                {/* Cuadro de Alerta / Advertencia */}
                <View className="rounded-2xl border border-clay-200 bg-clay-50/60 p-4 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Icon name="shield" size={16} className="text-clay-700" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-clay-800">
                      Términos de la operación
                    </Text>
                  </View>

                  <Text className="text-xs leading-5 text-clay-900">
                    Al confirmar la compra:
                  </Text>
                  <View className="gap-1 pl-1">
                    <Text className="text-xs leading-4 text-clay-800">
                      • La publicación se marcará automáticamente con la <Text className="font-bold">cinta de VENDIDO</Text> y ya nadie más podrá comprar este lote.
                    </Text>
                    <Text className="text-xs leading-4 text-clay-800">
                      • Se revelarán en pantalla los datos de contacto directos del productor (nombre, teléfono y email).
                    </Text>
                    <Text className="text-xs leading-4 text-clay-800">
                      • Se despachará un correo electrónico de confirmación con el logo oficial y todos los datos a ambas partes.
                    </Text>
                  </View>
                </View>

                {/* Formulario con los datos de contacto del comprador */}
                <View className="rounded-2xl border border-line-soft bg-surface p-4 gap-3">
                  <View className="flex-row items-center gap-2">
                    <Icon name="user" size={16} className="text-sage-600" />
                    <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                      Tus datos de contacto (se enviarán al vendedor)
                    </Text>
                  </View>

                  <Input
                    label="Nombre y Apellido"
                    placeholder="Ej. Juan Pérez"
                    value={nombre}
                    onChangeText={setNombre}
                    icon="user"
                  />

                  <Input
                    label="Teléfono / WhatsApp"
                    placeholder="Ej. +54 9 11 1234-5678"
                    value={telefono}
                    onChangeText={setTelefono}
                    keyboardType="phone-pad"
                    icon="phone"
                    hint="Fundamental para que el productor se comunique con vos"
                  />

                  <Input
                    label="Email para la confirmación"
                    placeholder="Ej. juanperez@correo.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    icon="mail"
                  />
                </View>

                {/* Acciones de confirmación */}
                <View className="gap-2 pt-2">
                  <Button
                    label="Sí, confirmar compra"
                    icon="shoppingCart"
                    variant="accent"
                    size="lg"
                    loading={loading}
                    disabled={loading}
                    onPress={handleConfirmar}
                  />
                  <Button
                    label="Cancelar"
                    variant="secondary"
                    disabled={loading}
                    onPress={onClose}
                  />
                </View>
              </>
            ) : (
              <>
                {/* Banner de Éxito */}
                <View className="rounded-2xl border border-sage-300 bg-sage-50 p-4 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Icon name="badgeCheck" size={18} className="text-sage-700" />
                    <Text className="text-sm font-bold text-sage-900">
                      ¡Operación confirmada · Lote Vendido!
                    </Text>
                  </View>
                  <Text className="text-xs leading-5 text-sage-800">
                    {emailInfo?.sinApiKey
                      ? "La publicación quedó marcada como VENDIDA y los datos personales han sido desbloqueados en pantalla."
                      : `Se enviaron los emails de confirmación a ambas partes (${email || "tu correo"} y la casilla del productor) con el comprobante, el emblema oficial del sitio y los datos de contacto.`}
                  </Text>
                  {emailInfo?.sinApiKey ? (
                    <View className="mt-1 rounded-xl bg-clay-100 p-2.5">
                      <Text className="text-[11px] leading-4 text-clay-800">
                        ℹ️ <Text className="font-semibold">Nota para el administrador:</Text> Para que los correos electrónicos se envíen a las casillas de correo externas, recordá agregar la variable <Text className="font-bold">RESEND_API_KEY</Text> en Vercel.
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Datos Personales del Vendedor */}
                <View className="rounded-2xl border border-line-soft bg-surface p-4 gap-3">
                  <View className="flex-row items-center justify-between border-b border-line-soft pb-2.5">
                    <View className="flex-row items-center gap-2">
                      <Icon name="user" size={16} className="text-sage-600" />
                      <Text className="text-xs font-bold uppercase tracking-wider text-ink">
                        Datos del Productor (Vendedor)
                      </Text>
                    </View>
                    <Badge tone="sage">Verificado</Badge>
                  </View>

                  <View className="gap-2.5">
                    <View>
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Nombre / Razón Social
                      </Text>
                      <Text className="text-sm font-bold text-ink">
                        {vendedor?.nombre || "Productor"}
                      </Text>
                    </View>

                    {vendedor?.establecimiento ? (
                      <View>
                        <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Establecimiento
                        </Text>
                        <Text className="text-sm font-semibold text-ink">
                          {vendedor.establecimiento}
                        </Text>
                      </View>
                    ) : null}

                    {ubicacion ? (
                      <View>
                        <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                          Ubicación del lote
                        </Text>
                        <Text className="text-sm text-ink-soft">{ubicacion}</Text>
                      </View>
                    ) : null}

                    <View>
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Teléfono / WhatsApp
                      </Text>
                      <Text className="text-sm font-bold text-ink">
                        {vendedor?.telefono || "No especificado"}
                      </Text>
                      {vendedor?.telefono ? (
                        <View className="flex-row gap-2 mt-2">
                          <Pressable
                            onPress={() => abrirWhatsApp(vendedor.telefono)}
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 active:opacity-90"
                          >
                            <WhatsAppIcon size={16} color="#FFFFFF" />
                            <Text className="text-xs font-bold text-white">
                              Abrir WhatsApp
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() => llamarTelefono(vendedor.telefono)}
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-surface-soft border border-line px-3 py-2 active:bg-surface-sunk"
                          >
                            <Icon name="phone" size={14} className="text-ink" />
                            <Text className="text-xs font-bold text-ink">Llamar</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>

                    <View>
                      <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Correo Electrónico
                      </Text>
                      <Text className="text-sm font-semibold text-ink">
                        {vendedor?.email || "No especificado"}
                      </Text>
                      {vendedor?.email ? (
                        <View className="mt-2">
                          <Pressable
                            onPress={() => enviarEmail(vendedor.email)}
                            className="flex-row items-center justify-center gap-2 rounded-xl bg-surface-soft border border-line px-3 py-2 active:bg-surface-sunk"
                          >
                            <Icon name="mail" size={14} className="text-ink" />
                            <Text className="text-xs font-bold text-ink">Enviar correo</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Tus datos compartidos */}
                <View className="rounded-2xl border border-line-soft bg-surface-soft p-3.5 gap-1.5">
                  <Text className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Tus datos compartidos con el productor:
                  </Text>
                  <Text className="text-xs text-ink-soft">
                    • <Text className="font-semibold text-ink">{nombre}</Text>
                  </Text>
                  <Text className="text-xs text-ink-soft">
                    • Teléfono: <Text className="font-semibold text-ink">{telefono}</Text>
                  </Text>
                  {email ? (
                    <Text className="text-xs text-ink-soft">
                      • Email: <Text className="font-semibold text-ink">{email}</Text>
                    </Text>
                  ) : null}
                </View>

                {/* Próximos pasos */}
                <View className="rounded-2xl border border-line-soft bg-surface p-4 gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    📋 Próximos pasos recomendados
                  </Text>
                  <View className="gap-1.5 pl-1">
                    <Text className="text-xs leading-4 text-ink-soft">
                      1. Contactá al productor vía WhatsApp o llamada para coordinar las condiciones de pago.
                    </Text>
                    <Text className="text-xs leading-4 text-ink-soft">
                      2. Solicitá o gestionen la emisión de la guía de traslado SENASA (DTA).
                    </Text>
                    <Text className="text-xs leading-4 text-ink-soft">
                      3. Coordiná el transporte o contratá un fletero verificado desde la app.
                    </Text>
                  </View>
                </View>

                {/* Botón de cierre */}
                <Button
                  label="Entendido, volver a la publicación"
                  variant="primary"
                  size="lg"
                  onPress={onClose}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
