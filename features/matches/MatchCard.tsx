import React from "react";
import { Text, View } from "react-native";
import { Icon } from "components/ui/Icon";
import { Avatar } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { MediaCover } from "components/ui/MediaCover";
import { portadaDe } from "components/ui/OfertaMedia";
import { formatPrecioOferta } from "features/offers/OfferCard";
import { maskNombreUsuario } from "lib/utils";
import { nivelMatch, razonesMatch } from "lib/matching";
import type { RazonMatch } from "lib/matching";
import type { MatchRow } from "lib/hooks/useMatches";

const ICONO_RAZON: Record<RazonMatch["clave"], "boxes" | "tag" | "mapPin" | "scale" | "coins"> = {
  categoria: "boxes",
  raza: "tag",
  distancia: "mapPin",
  peso: "scale",
  precio: "coins",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  rechazado: "Descartado",
  finalizado: "Finalizado",
};

export type MatchCardProps = {
  match: MatchRow;
  /** `oferta` cuando la contraparte es un lote; `demanda` cuando es una búsqueda. */
  contraparte: "oferta" | "demanda";
  onAceptar?: () => void;
  onRechazar?: () => void;
  onVerOferta?: () => void;
  onContactar?: () => void;
  busy?: boolean;
};

/**
 * Tarjeta de un cruce del matching: muestra la contraparte, el puntaje y por
 * qué coincidieron (misma categoría, raza, distancia, peso, precio).
 */
export function MatchCard({
  match,
  contraparte,
  onAceptar,
  onRechazar,
  onVerOferta,
  onContactar,
  busy = false,
}: MatchCardProps) {
  const oferta = match.ofertas;
  const demanda = match.demandas;
  const razones = razonesMatch(oferta, demanda);
  const nivel = nivelMatch(match.puntaje);
  const esOferta = contraparte === "oferta";
  const portada = portadaDe(oferta?.oferta_media ?? null);
  const contraparteNombre = maskNombreUsuario(
    esOferta ? oferta?.profiles?.nombre : demanda?.profiles?.nombre
  );

  return (
    <Card className="gap-0 overflow-hidden" padded={false}>
      <View className="gap-4 p-5">
        <View className="flex-row items-start gap-4">
          {esOferta ? (
            <View className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
              <MediaCover
                url={portada?.url}
                media={oferta?.oferta_media}
                showIndicators={false}
                categoria={oferta?.categoria}
                className="h-20 w-20"
                rounded="rounded-2xl"
              />
            </View>
          ) : (
            <View className="h-20 w-20 shrink-0 items-center justify-center gap-1 rounded-2xl bg-sky-50">
              <Icon name="search" size={22} className="text-sky-600" />
              <Text className="text-[9px] font-bold uppercase tracking-wide text-sky-700">
                Demanda
              </Text>
            </View>
          )}

          <View className="min-w-0 flex-1 gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Badge tone={nivel.tone} icon="sparkles">
                {`${match.puntaje}% · ${nivel.etiqueta}`}
              </Badge>
              {match.estado !== "pendiente" ? (
                <Badge
                  tone={match.estado === "aceptado" ? "sage" : "neutral"}
                  icon={match.estado === "aceptado" ? "checkCircle" : "x"}
                >
                  {ESTADO_LABEL[match.estado] ?? match.estado}
                </Badge>
              ) : null}
            </View>

            <Text className="text-base font-bold leading-5 text-ink" numberOfLines={2}>
              {esOferta
                ? `${oferta?.cantidad ?? ""} ${oferta?.categoria ?? ""}`.trim()
                : `Busca ${demanda?.categoria ?? ""}`}
            </Text>

            <View className="flex-row items-center gap-2">
              <Avatar
                uri={null}
                nombre={contraparteNombre}
                size={22}
              />
              <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
                {contraparteNombre}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {esOferta ? (
            <>
              {oferta?.precio != null ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="coins" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    {formatPrecioOferta(oferta)}
                  </Text>
                </View>
              ) : null}
              {oferta?.peso_promedio ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="scale" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    {oferta.peso_promedio} kg
                  </Text>
                </View>
              ) : null}
              {oferta?.provincia ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="mapPin" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft" numberOfLines={1}>
                    {oferta.localidad ? `${oferta.localidad}, ` : ""}
                    {oferta.provincia}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <>
              {demanda?.precio_max != null ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="coins" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    hasta ${Number(demanda.precio_max).toLocaleString("es-AR")}
                  </Text>
                </View>
              ) : null}
              {demanda?.peso_min_kg != null && demanda?.peso_max_kg != null ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="scale" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    {demanda.peso_min_kg} – {demanda.peso_max_kg} kg
                  </Text>
                </View>
              ) : null}
              {demanda?.radio_km ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="signal" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    {demanda.radio_km} km
                  </Text>
                </View>
              ) : null}
              {demanda?.provincia ? (
                <View className="flex-row items-center gap-1.5 rounded-xl bg-surface-soft px-2.5 py-1.5">
                  <Icon name="mapPin" size={14} className="text-ink-muted" />
                  <Text className="text-xs font-semibold text-ink-soft" numberOfLines={1}>
                    {demanda.localidad ? `${demanda.localidad}, ` : ""}
                    {demanda.provincia}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {razones.length > 0 ? (
          <View className="gap-2 rounded-2xl bg-surface-soft px-3 py-3">
            <Text className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
              Por qué te aparece
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {razones.map((razon) => (
                <View
                  key={razon.clave}
                  className="flex-row items-center gap-1.5 rounded-xl bg-surface px-2.5 py-1.5"
                >
                  <Icon name={ICONO_RAZON[razon.clave]} size={12} className="text-sage-600" />
                  <Text className="text-[11px] font-semibold text-ink-soft">
                    {razon.etiqueta}
                    {razon.detalle ? ` · ${razon.detalle}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-2 border-t border-line-soft px-5 py-4">
        {esOferta && onVerOferta ? (
          <Button
            label="Ver publicación"
            icon="eye"
            variant="secondary"
            size="sm"
            onPress={onVerOferta}
          />
        ) : null}

        {match.estado === "pendiente" ? (
          <>
            <Button
              label="Me interesa"
              icon="check"
              size="sm"
              onPress={onAceptar}
              loading={busy}
              disabled={busy}
            />
            {onContactar ? (
              <Button
                label="Consultar"
                icon="message"
                variant="soft"
                size="sm"
                onPress={onContactar}
                disabled={busy}
              />
            ) : null}
            <Button
              label="Descartar"
              icon="x"
              variant="ghost"
              size="sm"
              onPress={onRechazar}
              disabled={busy}
            />
          </>
        ) : (
          <Button
            label="Consultar por chat"
            icon="message"
            variant="soft"
            size="sm"
            onPress={onContactar}
            loading={busy}
            disabled={busy}
          />
        )}
      </View>
    </Card>
  );
}
