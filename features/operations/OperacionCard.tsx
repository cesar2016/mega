import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { MediaCover } from "components/ui/MediaCover";
import type { Operacion } from "lib/hooks/useOperaciones";

function formatPrecio(precio: number, tipo_precio?: string | null) {
  const formatted = `$${Number(precio).toLocaleString("es-AR")}`;
  if (tipo_precio === "por_kilo") return `${formatted} / kg`;
  if (tipo_precio === "por_cabeza") return `${formatted} / cab.`;
  return formatted;
}

function formatFecha(fechaIso: string) {
  try {
    const d = new Date(fechaIso);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaIso;
  }
}

export function OperacionCard({
  operacion,
  tipo,
}: {
  operacion: Operacion;
  tipo: "venta" | "compra";
}) {
  const router = useRouter();

  const esVenta = tipo === "venta";
  const precioTexto = formatPrecio(operacion.precio, operacion.tipo_precio);
  const mediaList = operacion.ofertas?.oferta_media ?? [];
  const ubicacion = [operacion.localidad, operacion.provincia].filter(Boolean).join(", ");

  // Datos de la contraparte
  const contraparteNombre = esVenta
    ? operacion.comprador_nombre || "Comprador"
    : operacion.vendedor_nombre || "Productor";

  const contraparteTelefono = esVenta
    ? operacion.comprador_telefono
    : operacion.vendedor_telefono;

  const contraparteEmail = esVenta
    ? operacion.comprador_email
    : operacion.vendedor_email;

  const establecimiento = !esVenta ? operacion.vendedor_establecimiento : null;

  const abrirWhatsApp = (numero?: string | null) => {
    if (!numero || numero.includes("No informado") || numero.includes("No especificado")) {
      showToast("Teléfono no disponible", "info");
      return;
    }
    const limpio = numero.replace(/[^0-9]/g, "");
    const mensaje = esVenta
      ? `Hola ${contraparteNombre}! Te contacto desde Mercado Ganadero por la compra confirmada de mi lote de ${operacion.categoria} (${operacion.cantidad} cabezas).`
      : `Hola ${contraparteNombre}! Te contacto desde Mercado Ganadero por la compra confirmada de tu lote de ${operacion.categoria} (${operacion.cantidad} cabezas).`;

    const url = `https://wa.me/${limpio}?text=${encodeURIComponent(mensaje)}`;
    Linking.openURL(url).catch(() => {
      showToast("No se pudo abrir WhatsApp", "error");
    });
  };

  const llamar = (numero?: string | null) => {
    if (!numero || numero.includes("No informado") || numero.includes("No especificado")) {
      showToast("Teléfono no disponible", "info");
      return;
    }
    Linking.openURL(`tel:${numero}`).catch(() => {
      showToast("No se pudo iniciar la llamada", "error");
    });
  };

  const enviarMail = (email?: string | null) => {
    if (!email || email.includes("@mercadoganadero.app")) {
      showToast("Correo electrónico no disponible", "info");
      return;
    }
    const asunto = `Mercado Ganadero - Operación de lote de ${operacion.categoria}`;
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(asunto)}`).catch(() => {
      showToast("No se pudo abrir el cliente de correo", "error");
    });
  };

  return (
    <Card className="overflow-hidden border border-line-soft bg-surface gap-0">
      {/* Cabecera de la operación */}
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-surface-soft px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Badge tone={esVenta ? "clay" : "sage"} icon={esVenta ? "tag" : "shoppingCart"}>
            {esVenta ? "Venta concretada" : "Compra confirmada"}
          </Badge>
          <Text className="text-xs font-semibold text-ink-muted">
            {formatFecha(operacion.created_at)}
          </Text>
        </View>

        <Pressable
          onPress={() => router.push(`/(main)/oferta/${operacion.oferta_id}`)}
          className="flex-row items-center gap-1 rounded-lg px-2 py-1 active:bg-surface-sunk cursor-pointer"
        >
          <Text className="text-xs font-bold text-sage-700">Ver lote</Text>
          <Icon name="arrowRight" size={13} className="text-sage-700" />
        </Pressable>
      </View>

      <View className="p-4 gap-4">
        {/* Fila principal: Portada + Datos del Lote */}
        <View className="flex-col sm:flex-row gap-4 items-start">
          {mediaList.length > 0 ? (
            <View className="w-full sm:w-32 h-28 shrink-0 overflow-hidden rounded-xl border border-line-soft">
              <MediaCover
                media={mediaList}
                categoria={operacion.categoria}
                rounded="rounded-xl"
                showIndicators={false}
              />
            </View>
          ) : (
            <View className="w-full sm:w-32 h-28 shrink-0 items-center justify-center rounded-xl bg-surface-soft border border-line-soft">
              <Icon name="beef" size={32} className="text-sage-500" />
            </View>
          )}

          <View className="flex-1 min-w-0 gap-1.5">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-base font-extrabold text-ink">
                {operacion.categoria}
              </Text>
              {operacion.raza ? (
                <Badge tone="neutral">{operacion.raza}</Badge>
              ) : null}
            </View>

            <Text className="text-sm font-semibold text-ink-soft">
              {operacion.cantidad} cabezas ·{" "}
              <Text className="font-extrabold text-ink">{precioTexto}</Text>
            </Text>

            {ubicacion ? (
              <View className="flex-row items-center gap-1 mt-0.5">
                <Icon name="mapPin" size={13} className="text-ink-muted" />
                <Text className="text-xs text-ink-muted" numberOfLines={1}>
                  {ubicacion}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Tarjeta destacada de la contraparte con acciones */}
        <View
          className={`rounded-2xl border p-4 gap-3 ${
            esVenta ? "border-amber-200 bg-amber-50/60" : "border-sage-200 bg-sage-50/60"
          }`}
        >
          <View className="flex-row items-center justify-between border-b border-black/5 pb-2">
            <View className="flex-row items-center gap-2">
              <Icon
                name={esVenta ? "user" : "building"}
                size={16}
                className={esVenta ? "text-amber-800" : "text-sage-800"}
              />
              <Text className="text-xs font-bold uppercase tracking-wider text-ink">
                {esVenta ? "Datos del Comprador" : "Datos del Productor (Vendedor)"}
              </Text>
            </View>
            <Badge tone={esVenta ? "clay" : "sage"}>Contraparte</Badge>
          </View>

          <View className="gap-1.5 text-xs">
            <View className="flex-row items-baseline gap-2">
              <Text className="text-xs font-semibold text-ink-muted">Nombre / Razón Social:</Text>
              <Text className="text-sm font-bold text-ink">{contraparteNombre}</Text>
            </View>

            {establecimiento ? (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-xs font-semibold text-ink-muted">Establecimiento:</Text>
                <Text className="text-xs font-bold text-ink">{establecimiento}</Text>
              </View>
            ) : null}

            {contraparteTelefono ? (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-xs font-semibold text-ink-muted">Teléfono / WhatsApp:</Text>
                <Text className="text-xs font-bold text-ink">{contraparteTelefono}</Text>
              </View>
            ) : null}

            {contraparteEmail && !contraparteEmail.includes("@mercadoganadero.app") ? (
              <View className="flex-row items-baseline gap-2">
                <Text className="text-xs font-semibold text-ink-muted">Email:</Text>
                <Text className="text-xs font-bold text-ink">{contraparteEmail}</Text>
              </View>
            ) : null}
          </View>

          {/* Botones de acción directa */}
          <View className="flex-row flex-wrap items-center gap-2 pt-1 border-t border-black/5">
            {contraparteTelefono ? (
              <>
                <Button
                  label="WhatsApp"
                  icon="message"
                  size="sm"
                  variant="primary"
                  onPress={() => abrirWhatsApp(contraparteTelefono)}
                />
                <Button
                  label="Llamar"
                  icon="phone"
                  size="sm"
                  variant="secondary"
                  onPress={() => llamar(contraparteTelefono)}
                />
              </>
            ) : null}

            {contraparteEmail && !contraparteEmail.includes("@mercadoganadero.app") ? (
              <Button
                label="Email"
                icon="mail"
                size="sm"
                variant="secondary"
                onPress={() => enviarMail(contraparteEmail)}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Card>
  );
}
