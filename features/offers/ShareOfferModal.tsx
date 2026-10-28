import React, { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { Icon } from "components/ui/Icon";
import { Badge } from "components/ui/Card";
import { showToast } from "lib/utils";
import { mediaOrdenado, parseVideoTrimUrl, portadaDe } from "components/ui/OfertaMedia";
import type { OfertaMediaRow } from "components/ui/OfertaMedia";
import {
  FacebookIcon,
  TelegramIcon,
  WhatsAppIcon,
} from "components/ui/SocialIcons";

export type ShareableOferta = {
  id: string;
  categoria: string;
  raza?: string | null;
  cantidad: number;
  precio: number;
  tipo_precio?: string | null;
  peso_promedio?: number | null;
  provincia?: string | null;
  localidad?: string | null;
  oferta_media?: OfertaMediaRow[] | null;
};

export function getOfertaShareUrl(ofertaId: string): string {
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/oferta/${ofertaId}`;
  }
  const base = process.env.EXPO_PUBLIC_APP_URL || "https://mercadoganadero.com";
  return `${base.replace(/\/$/, "")}/oferta/${ofertaId}`;
}

function formatPrecioShare(precio: number, tipo_precio?: string | null) {
  if (tipo_precio === "por_kilo") return `$${Number(precio).toLocaleString("es-AR")} / kg`;
  if (tipo_precio === "por_cabeza") return `$${Number(precio).toLocaleString("es-AR")} / cabeza`;
  return `$${Number(precio).toLocaleString("es-AR")}`;
}

export function buildOfertaSharePayload(oferta: ShareableOferta) {
  const url = getOfertaShareUrl(oferta.id);
  const titulo = `Lote de ${oferta.categoria} (${oferta.cantidad} cab.) - Mercado Ganadero`;
  const ubicacion = [oferta.localidad, oferta.provincia].filter(Boolean).join(", ");
  const precioTexto = formatPrecioShare(oferta.precio, oferta.tipo_precio);

  const resumen = `${oferta.raza || "Lote de " + oferta.categoria} · ${oferta.cantidad} cabezas · ${precioTexto}${ubicacion ? " · " + ubicacion : ""}`;

  const mensajeCompleto =
    `🐮 *${oferta.raza || "Lote de " + oferta.categoria}* en Mercado Ganadero\n\n` +
    `• Categoría: ${oferta.categoria}\n` +
    `• Cantidad: ${oferta.cantidad} cabezas\n` +
    (oferta.peso_promedio ? `• Peso prom.: ${oferta.peso_promedio} kg\n` : "") +
    `• Precio: ${precioTexto}\n` +
    (ubicacion ? `• Ubicación: ${ubicacion}\n` : "") +
    `\nMirá los detalles y fotos en:\n${url}`;

  return {
    url,
    title: titulo,
    summary: resumen,
    fullMessage: mensajeCompleto,
  };
}

async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fallback abajo
      }
    }
    if (typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(textarea);
        return ok;
      } catch {
        return false;
      }
    }
    return false;
  } else {
    try {
      await Share.share({ message: text });
      return true;
    } catch {
      return false;
    }
  }
}

export function ShareOfferModal({
  visible,
  onClose,
  oferta,
  portadaUrl,
}: {
  visible: boolean;
  onClose: () => void;
  oferta: ShareableOferta;
  portadaUrl?: string | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const payload = buildOfertaSharePayload(oferta);

  // Obtener la mejor URL de miniatura (portada elegida, foto activa o primer archivo)
  const todosMedia = mediaOrdenado(oferta.oferta_media);
  const portadaMedia = portadaDe(oferta.oferta_media) ?? todosMedia[0] ?? null;
  const mediaUrl = portadaUrl || portadaMedia?.url || null;
  const esVideo = (mediaUrl && mediaUrl.includes(".mp4")) || portadaMedia?.tipo === "video";

  if (!visible) return null;

  const handleCopiar = async () => {
    const exito = await copyText(payload.url);
    if (exito) {
      setCopiado(true);
      showToast("Enlace copiado al portapapeles", "success");
      setTimeout(() => setCopiado(false), 2500);
    } else {
      showToast("No se pudo copiar el enlace", "error");
    }
  };

  const abrirEnlace = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.error("Error al abrir red social:", e);
      await handleCopiar();
    }
  };

  const shareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(payload.fullMessage)}`;
    abrirEnlace(waUrl);
  };

  const shareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`;
    abrirEnlace(fbUrl);
  };

  const shareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(payload.summary)}`;
    abrirEnlace(tgUrl);
  };

  const shareSistema = async () => {
    if (Platform.OS !== "web") {
      try {
        await Share.share({
          title: payload.title,
          message: Platform.OS === "android" ? payload.fullMessage : payload.summary,
          url: payload.url,
        });
      } catch {
        // Cancelado
      }
    } else if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.summary,
          url: payload.url,
        });
      } catch {
        // Cancelado
      }
    } else {
      await handleCopiar();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-ink/70 p-4">
        <Pressable
          onPress={onClose}
          className="absolute inset-0"
          accessibilityLabel="Cerrar modal"
        />

        <View className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface shadow-lift">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-line-soft px-5 py-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-sage-50">
                <Icon name="share" size={18} className="text-sage-600" />
              </View>
              <View>
                <Text className="text-base font-bold text-ink">Compartir publicación</Text>
                <Text className="text-xs text-ink-muted">Enviá este lote a tus contactos o redes</Text>
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

          <View className="gap-4 p-5">
            {/* Tarjeta resumen del lote con miniatura */}
            <View className="flex-row items-center gap-3 rounded-2xl border border-line-soft bg-surface-soft p-3">
              <View className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line-soft bg-surface-sunk">
                {mediaUrl ? (
                  Platform.OS === "web" ? (
                    esVideo ? (
                      <video
                        src={mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(e) => {
                          const { inicio } = parseVideoTrimUrl(mediaUrl);
                          e.currentTarget.currentTime = inicio ?? 0.1;
                        }}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          pointerEvents: "none",
                        }}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt={oferta.raza || oferta.categoria}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )
                  ) : (
                    <Image
                      source={{ uri: mediaUrl }}
                      style={{ width: 56, height: 56 }}
                      resizeMode="cover"
                    />
                  )
                ) : (
                  <View className="h-full w-full items-center justify-center bg-sage-50">
                    <Icon name="beef" size={22} className="text-sage-500" />
                  </View>
                )}
              </View>

              <View className="min-w-0 flex-1 gap-1">
                <View className="flex-row items-center gap-1.5">
                  <Badge tone="sage">
                    {oferta.categoria?.toUpperCase() ?? "LOTE"}
                  </Badge>
                  <Text className="text-xs font-semibold text-ink-muted">
                    {oferta.cantidad} cabezas
                  </Text>
                </View>
                <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                  {oferta.raza || `Lote de ${oferta.categoria}`}
                </Text>
                <Text className="text-xs font-bold text-sage-600">
                  {formatPrecioShare(oferta.precio, oferta.tipo_precio)}
                </Text>
              </View>
            </View>

            {/* Redes sociales */}
            <View className="gap-2.5">
              <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Compartir en redes
              </Text>

              {/* WhatsApp - Destacado */}
              <Pressable
                onPress={shareWhatsApp}
                accessibilityRole="button"
                accessibilityLabel="Compartir en WhatsApp"
                className="flex-row items-center gap-3 rounded-2xl bg-[#25D366] px-4 py-3.5 shadow-soft active:opacity-90"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                  <WhatsAppIcon size={22} color="#FFFFFF" />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-bold text-white">WhatsApp</Text>
                  <Text className="text-xs text-white/85" numberOfLines={1}>
                    Enviar a contactos o grupos de compra-venta
                  </Text>
                </View>
                <Icon name="arrowRight" size={16} className="text-white/80" />
              </Pressable>

              {/* Facebook y Telegram en fila */}
              <View className="flex-row gap-2.5">
                <Pressable
                  onPress={shareFacebook}
                  accessibilityRole="button"
                  accessibilityLabel="Compartir en Facebook"
                  className="flex-1 flex-row items-center gap-2.5 rounded-2xl bg-[#1877F2] px-3.5 py-3 shadow-soft active:opacity-90"
                >
                  <FacebookIcon size={20} color="#FFFFFF" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs font-bold text-white">Facebook</Text>
                    <Text className="text-[10px] text-white/80" numberOfLines={1}>
                      Feed o muro
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={shareTelegram}
                  accessibilityRole="button"
                  accessibilityLabel="Compartir en Telegram"
                  className="flex-1 flex-row items-center gap-2.5 rounded-2xl bg-[#229ED9] px-3.5 py-3 shadow-soft active:opacity-90"
                >
                  <TelegramIcon size={20} color="#FFFFFF" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-xs font-bold text-white">Telegram</Text>
                    <Text className="text-[10px] text-white/80" numberOfLines={1}>
                      Canal o chat
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Botón de más opciones del sistema */}
              <Pressable
                onPress={shareSistema}
                accessibilityRole="button"
                accessibilityLabel="Más opciones para compartir"
                className="flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-surface-soft px-3.5 py-2.5 active:bg-surface-sunk"
              >
                <Icon name="share" size={15} className="text-ink-soft" />
                <Text className="text-xs font-semibold text-ink">
                  {Platform.OS === "web" ? "Más opciones del navegador / dispositivo" : "Abrir menú de compartir del teléfono"}
                </Text>
              </Pressable>
            </View>

            {/* Copiar enlace directo */}
            <View className="gap-2 border-t border-line-soft pt-3">
              <Text className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                O copiá el enlace directo
              </Text>
              <View className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface-soft p-1.5 pl-3">
                <Icon name="link" size={14} className="text-ink-muted" />
                <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
                  {payload.url}
                </Text>
                <Pressable
                  onPress={handleCopiar}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar enlace"
                  className={[
                    "flex-row items-center gap-1.5 rounded-xl px-3 py-2",
                    copiado ? "bg-sage-600" : "bg-ink active:bg-ink-soft",
                  ].join(" ")}
                >
                  <Icon
                    name={copiado ? "check" : "copy"}
                    size={13}
                    className="text-white"
                  />
                  <Text className="text-xs font-bold text-white">
                    {copiado ? "Copiado" : "Copiar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
