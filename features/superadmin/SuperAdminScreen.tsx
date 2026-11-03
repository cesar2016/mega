import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "store/authStore";
import { isSuperAdmin, useSuperAdminData } from "lib/superAdmin";
import type { VisitaSitioRow } from "lib/superAdmin";
import { Icon } from "components/ui/Icon";
import { Avatar, EmptyState } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";

type TabSuperAdmin = "usuarios" | "visitas" | "repetidas" | "origenes";

function formatearFechaHora(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SuperAdminScreen() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const loadingAuth = useAuthStore((state) => state.loading);

  const autorizado = isSuperAdmin(profile, user);
  const [tab, setTab] = useState<TabSuperAdmin>("usuarios");
  const [busqueda, setBusqueda] = useState("");

  const { usuarios, visitas, isLoading, isRefetching, error, refetch } =
    useSuperAdminData(autorizado);

  // Agrupación por visitante único (user_id o visitor_id) para detectar visitas repetidas y orígenes
  const resumenVisitantes = useMemo(() => {
    const mapa = new Map<
      string,
      {
        clave: string;
        esRegistrado: boolean;
        nombre: string;
        nombreCompleto: string | null;
        email: string | null;
        cantidadVisitas: number;
        primeraVisita: string;
        ultimaVisita: string;
        ubicaciones: string[];
        ips: string[];
        dispositivos: string[];
        rutas: string[];
        historial: VisitaSitioRow[];
      }
    >();

    for (const v of visitas) {
      const clave = v.user_id ? `user_${v.user_id}` : `anon_${v.visitor_id}`;
      const existente = mapa.get(clave);
      const ubicacion = [v.ciudad, v.provincia, v.pais]
        .filter((x) => x && x !== "Sin especificar")
        .join(", ") || "Ubicación no informada";

      const nombreMostrar =
        v.usuario_nombre ||
        (v.user_id ? "Usuario registrado" : `Visitante (${v.visitor_id.slice(0, 10)})`);

      if (!existente) {
        mapa.set(clave, {
          clave,
          esRegistrado: Boolean(v.user_id),
          nombre: nombreMostrar,
          nombreCompleto: v.usuario_nombre_completo || null,
          email: v.usuario_email || null,
          cantidadVisitas: 1,
          primeraVisita: v.created_at,
          ultimaVisita: v.created_at,
          ubicaciones: [ubicacion],
          ips: v.ip ? [v.ip] : [],
          dispositivos: v.dispositivo ? [v.dispositivo] : [],
          rutas: v.ruta ? [v.ruta] : ["/"],
          historial: [v],
        });
      } else {
        existente.cantidadVisitas += 1;
        if (v.created_at < existente.primeraVisita) {
          existente.primeraVisita = v.created_at;
        }
        if (v.created_at > existente.ultimaVisita) {
          existente.ultimaVisita = v.created_at;
        }
        if (!existente.ubicaciones.includes(ubicacion)) {
          existente.ubicaciones.push(ubicacion);
        }
        if (v.ip && !existente.ips.includes(v.ip)) {
          existente.ips.push(v.ip);
        }
        if (v.dispositivo && !existente.dispositivos.includes(v.dispositivo)) {
          existente.dispositivos.push(v.dispositivo);
        }
        if (v.ruta && !existente.rutas.includes(v.ruta)) {
          existente.rutas.push(v.ruta);
        }
        existente.historial.push(v);
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) =>
        b.cantidadVisitas - a.cantidadVisitas ||
        new Date(b.ultimaVisita).getTime() - new Date(a.ultimaVisita).getTime()
    );
  }, [visitas]);

  const visitasRepetidas = useMemo(
    () => resumenVisitantes.filter((v) => v.cantidadVisitas >= 2),
    [resumenVisitantes]
  );

  // Agrupación geográfica por Provincia / Ciudad
  const rankingUbicaciones = useMemo(() => {
    const conteo = new Map<
      string,
      { lugar: string; totalVisitas: number; visitantesUnicos: Set<string> }
    >();
    for (const v of visitas) {
      const lugar =
        [v.ciudad, v.provincia, v.pais]
          .filter((x) => x && x !== "Sin especificar")
          .join(", ") || "Ubicación sin especificar";
      const claveVis = v.user_id || v.visitor_id;
      const item = conteo.get(lugar);
      if (!item) {
        conteo.set(lugar, {
          lugar,
          totalVisitas: 1,
          visitantesUnicos: new Set([claveVis]),
        });
      } else {
        item.totalVisitas += 1;
        item.visitantesUnicos.add(claveVis);
      }
    }
    return Array.from(conteo.values())
      .map((x) => ({
        lugar: x.lugar,
        totalVisitas: x.totalVisitas,
        visitantesUnicos: x.visitantesUnicos.size,
      }))
      .sort((a, b) => b.totalVisitas - a.totalVisitas);
  }, [visitas]);

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      [
        u.nombre,
        u.nombre_completo,
        u.email,
        u.cuit,
        u.telefono,
        u.provincia,
        u.localidad,
        u.establecimiento,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [usuarios, busqueda]);

  if (loadingAuth) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
      </View>
    );
  }

  // Bloqueo estricto: solo Mega.Oficial_1 puede acceder a esta pantalla
  if (!autorizado) {
    return <Redirect href="/" />;
  }

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Panel SuperAdmin" />

      <Screen
        eyebrow="Acceso exclusivo · Mega.Oficial_1"
        title="Panel de Control SuperAdmin"
        subtitle="Monitoreo en tiempo real de usuarios registrados, tráfico del sitio, visitas repetidas y origen geográfico de los visitantes."
        onRefresh={() => refetch()}
        refreshing={isRefetching}
        action={
          <Button
            label="Actualizar datos"
            icon="refresh"
            variant="secondary"
            onPress={() => refetch()}
            className="hidden md:flex"
          />
        }
      >
        {/* 4 Tarjetas de Resumen General (clickeables para ir a cada sección) */}
        <View className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Pressable
            onPress={() => setTab("usuarios")}
            className={[
              "rounded-2xl border p-4 gap-2 cursor-pointer",
              tab === "usuarios"
                ? "border-sage-500 bg-sage-50"
                : "border-line-soft bg-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center justify-between">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-sage-100">
                <Icon name="user" size={18} className="text-sage-700" />
              </View>
              <Badge tone="sage">1 · Usuarios</Badge>
            </View>
            <Text className="text-2xl font-extrabold text-ink">{usuarios.length}</Text>
            <Text className="text-xs font-semibold text-ink-muted">
              Usuarios registrados en la plataforma
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("visitas")}
            className={[
              "rounded-2xl border p-4 gap-2 cursor-pointer",
              tab === "visitas"
                ? "border-sky-500 bg-sky-50/70"
                : "border-line-soft bg-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center justify-between">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                <Icon name="eye" size={18} className="text-sky-700" />
              </View>
              <Badge tone="wheat">2 · Tráfico total</Badge>
            </View>
            <Text className="text-2xl font-extrabold text-ink">{visitas.length}</Text>
            <Text className="text-xs font-semibold text-ink-muted">
              Visitas totales recibidas ({resumenVisitantes.length} visitantes únicos)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("repetidas")}
            className={[
              "rounded-2xl border p-4 gap-2 cursor-pointer",
              tab === "repetidas"
                ? "border-amber-500 bg-amber-50/70"
                : "border-line-soft bg-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center justify-between">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Icon name="refresh" size={18} className="text-amber-800" />
              </View>
              <Badge tone="clay">3 · Recurrentes</Badge>
            </View>
            <Text className="text-2xl font-extrabold text-ink">
              {visitasRepetidas.length}
            </Text>
            <Text className="text-xs font-semibold text-ink-muted">
              Visitantes con visitas repetidas (2 o más ingresos)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTab("origenes")}
            className={[
              "rounded-2xl border p-4 gap-2 cursor-pointer",
              tab === "origenes"
                ? "border-sage-500 bg-sage-50"
                : "border-line-soft bg-surface",
            ].join(" ")}
          >
            <View className="flex-row items-center justify-between">
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-sage-100">
                <Icon name="mapPin" size={18} className="text-sage-700" />
              </View>
              <Badge tone="sage">4 · Quiénes y de dónde</Badge>
            </View>
            <Text className="text-2xl font-extrabold text-ink">
              {rankingUbicaciones.length}
            </Text>
            <Text className="text-xs font-semibold text-ink-muted">
              Localidades / provincias de origen detectadas
            </Text>
          </Pressable>
        </View>

        {/* Barra de Pestañas */}
        <View className="flex-row flex-wrap items-center gap-2 rounded-2xl border border-line-soft bg-surface-soft p-1.5">
          {[
            { id: "usuarios", label: `1. Usuarios registrados (${usuarios.length})`, icon: "user" },
            { id: "visitas", label: `2. Visitas al sitio (${visitas.length})`, icon: "eye" },
            {
              id: "repetidas",
              label: `3. Visitas repetidas (${visitasRepetidas.length})`,
              icon: "refresh",
            },
            {
              id: "origenes",
              label: "4. Quiénes y de dónde visitaron",
              icon: "mapPin",
            },
          ].map((item) => {
            const activa = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id as TabSuperAdmin)}
                className={[
                  "flex-1 min-w-[160px] flex-row items-center justify-center gap-2 rounded-xl py-2.5 px-3 cursor-pointer",
                  activa ? "bg-surface shadow-xs border border-line" : "opacity-75",
                ].join(" ")}
              >
                <Icon
                  name={item.icon as any}
                  size={15}
                  className={activa ? "text-sage-700" : "text-ink-muted"}
                />
                <Text
                  className={`text-xs font-bold ${
                    activa ? "text-ink" : "text-ink-muted"
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <Card className="items-center justify-center py-12 gap-3">
            <ActivityIndicator size="large" className="text-sage-500" />
            <Text className="text-sm text-ink-muted">
              Cargando información de SuperAdmin...
            </Text>
          </Card>
        ) : error ? (
          <EmptyState
            icon="cloudOff"
            title="No se pudieron obtener los datos"
            description={String((error as Error)?.message ?? error)}
            action={<Button label="Reintentar" icon="refresh" onPress={() => refetch()} />}
          />
        ) : tab === "usuarios" ? (
          /* SECCIÓN 1: USUARIOS REGISTRADOS */
          <View className="gap-4">
            <Card className="gap-3 p-4">
              <View className="flex-row items-center gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2">
                <Icon name="search" size={16} className="text-ink-muted" />
                <TextInput
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar usuario por nombre, correo, CUIT, teléfono o provincia..."
                  placeholderTextColor="#8C978E"
                  className="flex-1 text-xs font-semibold text-ink outline-none"
                />
                {busqueda ? (
                  <Pressable onPress={() => setBusqueda("")}>
                    <Icon name="x" size={14} className="text-ink-muted" />
                  </Pressable>
                ) : null}
              </View>
            </Card>

            <View className="gap-3">
              {usuariosFiltrados.map((u) => {
                const ubicacion =
                  [u.localidad, u.provincia].filter(Boolean).join(", ") ||
                  "Sin ubicación cargada";
                const esAdmin = u.id === "5446e68a-1482-452d-9bfe-e0bd3eb7d361" || u.rol === "admin";
                return (
                  <Card key={u.id} className="gap-3 border border-line-soft p-4">
                    <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
                      <View className="flex-row items-center gap-3">
                        <Avatar uri={null} nombre={u.nombre} size={42} />
                        <View className="gap-0.5">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text className="text-base font-extrabold text-ink">
                              {u.nombre || "Sin usuario"}
                            </Text>
                            {esAdmin ? (
                              <Badge tone="clay" icon="shield">
                                SuperAdmin
                              </Badge>
                            ) : (
                              <Badge tone="sage">{u.rol || "productor"}</Badge>
                            )}
                            {u.email_confirmed_at ? (
                              <Badge tone="sage" icon="badgeCheck">
                                Email confirmado
                              </Badge>
                            ) : (
                              <Badge tone="wheat">Email pendiente</Badge>
                            )}
                          </View>
                          {u.nombre_completo ? (
                            <Text className="text-xs font-semibold text-ink-soft">
                              {u.nombre_completo}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View className="flex-row items-center gap-2">
                        <Badge tone="neutral">{`${u.total_ofertas} lotes`}</Badge>
                        <Badge tone="wheat">{`${u.total_visitas_sitio} visitas`}</Badge>
                      </View>
                    </View>

                    <View className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <View className="rounded-xl bg-surface-soft p-2.5">
                        <Text className="text-[10px] font-bold uppercase text-ink-muted">
                          Correo electrónico
                        </Text>
                        <Text className="text-xs font-bold text-ink">
                          {u.email || "—"}
                        </Text>
                      </View>

                      <View className="rounded-xl bg-surface-soft p-2.5">
                        <Text className="text-[10px] font-bold uppercase text-ink-muted">
                          CUIT / Teléfono
                        </Text>
                        <Text className="text-xs font-bold text-ink">
                          {[u.cuit, u.telefono].filter(Boolean).join(" · ") || "Sin informar"}
                        </Text>
                      </View>

                      <View className="rounded-xl bg-surface-soft p-2.5">
                        <Text className="text-[10px] font-bold uppercase text-ink-muted">
                          Ubicación / Establecimiento
                        </Text>
                        <Text className="text-xs font-bold text-ink">
                          {[ubicacion, u.establecimiento].filter(Boolean).join(" · ")}
                        </Text>
                      </View>

                      <View className="rounded-xl bg-surface-soft p-2.5">
                        <Text className="text-[10px] font-bold uppercase text-ink-muted">
                          Alta / Último ingreso
                        </Text>
                        <Text className="text-xs font-bold text-ink">
                          {formatearFechaHora(u.created_at)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        ) : tab === "visitas" ? (
          /* SECCIÓN 2: LAS VISITAS QUE RECIBIÓ EL SITIO */
          <View className="gap-3">
            {visitas.length === 0 ? (
              <EmptyState
                icon="eye"
                title="Aún no hay visitas registradas"
                description="Cada ingreso al sitio se registra automáticamente en tiempo real."
              />
            ) : (
              visitas.map((v) => {
                const lugar =
                  [v.ciudad, v.provincia, v.pais]
                    .filter((x) => x && x !== "Sin especificar")
                    .join(", ") || "Ubicación sin especificar";
                return (
                  <Card key={v.id} className="flex-col gap-2 border border-line-soft p-4 sm:flex-row sm:items-center sm:justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 items-center justify-center rounded-xl bg-sage-50">
                        <Icon
                          name={v.user_id ? "user" : "eye"}
                          size={18}
                          className="text-sage-700"
                        />
                      </View>
                      <View className="gap-0.5">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-sm font-extrabold text-ink">
                            {v.usuario_nombre || `Visitante (${v.visitor_id.slice(0, 10)})`}
                          </Text>
                          <Badge tone={v.user_id ? "sage" : "neutral"}>
                            {v.user_id ? "Registrado" : "Visitante"}
                          </Badge>
                          {v.dispositivo ? (
                            <Badge tone="wheat">{v.dispositivo}</Badge>
                          ) : null}
                        </View>
                        <Text className="text-xs text-ink-muted">
                          📍 {lugar} {v.ip ? `· IP: ${v.ip}` : ""} · Ruta: {v.ruta || "/"}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-xs font-bold text-ink-soft">
                      {formatearFechaHora(v.created_at)}
                    </Text>
                  </Card>
                );
              })
            )}
          </View>
        ) : tab === "repetidas" ? (
          /* SECCIÓN 3: CUÁLES FUERON VISITAS REPETIDAS */
          <View className="gap-3">
            {visitasRepetidas.length === 0 ? (
              <EmptyState
                icon="refresh"
                title="Todavía no se registran visitas repetidas"
                description="Cuando un mismo usuario o dispositivo ingrese 2 o más veces al sitio, aparecerá detallado aquí con la cantidad de ingresos."
              />
            ) : (
              visitasRepetidas.map((item) => (
                <Card key={item.clave} className="gap-3 border border-amber-200 bg-amber-50/40 p-4">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <View className="flex-row items-center gap-3">
                      <Avatar uri={null} nombre={item.nombre} size={40} />
                      <View className="gap-0.5">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-sm font-extrabold text-ink">
                            {item.nombre}
                          </Text>
                          <Badge tone="clay" icon="refresh">
                            {`${item.cantidadVisitas} visitas registradas`}
                          </Badge>
                          <Badge tone={item.esRegistrado ? "sage" : "neutral"}>
                            {item.esRegistrado ? "Usuario registrado" : "Visitante recurrente"}
                          </Badge>
                        </View>
                        {item.email ? (
                          <Text className="text-xs text-ink-muted">{item.email}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View className="items-end">
                      <Text className="text-[11px] font-semibold text-ink-muted">
                        Última visita: {formatearFechaHora(item.ultimaVisita)}
                      </Text>
                      <Text className="text-[11px] text-ink-muted">
                        Primera visita: {formatearFechaHora(item.primeraVisita)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row flex-wrap gap-2 border-t border-amber-200/60 pt-2.5">
                    <Text className="text-xs font-semibold text-ink-soft">
                      📍 Desde: {item.ubicaciones.join(" / ")}
                    </Text>
                    {item.dispositivos.length > 0 ? (
                      <Text className="text-xs text-ink-muted">
                        · 💻 {item.dispositivos.join(", ")}
                      </Text>
                    ) : null}
                    {item.ips.length > 0 ? (
                      <Text className="text-xs text-ink-muted">
                        · 🌐 IP: {item.ips.join(", ")}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : (
          /* SECCIÓN 4: QUIÉNES Y DE DÓNDE HAN VISITADO EL SITIO */
          <View className="gap-5">
            {/* Resumen por Origen Geográfico (De dónde) */}
            <Card className="gap-3 p-4">
              <View className="flex-row items-center gap-2">
                <Icon name="mapPin" size={18} className="text-sage-700" />
                <Text className="text-sm font-extrabold text-ink">
                  De dónde nos visitan (Localidad / Provincia / País)
                </Text>
              </View>

              {rankingUbicaciones.length === 0 ? (
                <Text className="text-xs text-ink-muted">
                  Sin datos de ubicación todavía.
                </Text>
              ) : (
                <View className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {rankingUbicaciones.map((ub) => (
                    <View
                      key={ub.lugar}
                      className="flex-row items-center justify-between rounded-2xl border border-line-soft bg-surface-soft px-3.5 py-3"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs font-extrabold text-ink" numberOfLines={1}>
                          📍 {ub.lugar}
                        </Text>
                        <Text className="text-[11px] text-ink-muted">
                          {ub.visitantesUnicos}{" "}
                          {ub.visitantesUnicos === 1 ? "visitante único" : "visitantes únicos"}
                        </Text>
                      </View>
                      <Badge tone="sage">{`${ub.totalVisitas} visitas`}</Badge>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Detalle de Quiénes y de dónde */}
            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Detalle por visitante (Quiénes y desde dónde ingresaron)
              </Text>
              {resumenVisitantes.map((v) => (
                <Card key={v.clave} className="gap-2.5 border border-line-soft p-4">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <View className="flex-row items-center gap-3">
                      <Avatar uri={null} nombre={v.nombre} size={38} />
                      <View>
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-sm font-extrabold text-ink">
                            {v.nombre}
                          </Text>
                          {v.nombreCompleto ? (
                            <Text className="text-xs font-semibold text-ink-soft">
                              ({v.nombreCompleto})
                            </Text>
                          ) : null}
                          <Badge tone={v.esRegistrado ? "sage" : "neutral"}>
                            {v.esRegistrado ? "Usuario registrado" : "Visitante sin cuenta"}
                          </Badge>
                          {v.cantidadVisitas > 1 ? (
                            <Badge tone="clay">{`${v.cantidadVisitas} ingresos`}</Badge>
                          ) : (
                            <Badge tone="wheat">1 ingreso</Badge>
                          )}
                        </View>
                        {v.email ? (
                          <Text className="text-xs text-ink-muted">{v.email}</Text>
                        ) : null}
                      </View>
                    </View>

                    <Text className="text-xs font-semibold text-ink-muted">
                      Último ingreso: {formatearFechaHora(v.ultimaVisita)}
                    </Text>
                  </View>

                  <View className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1">
                    <View className="rounded-xl bg-surface-soft p-2.5">
                      <Text className="text-[10px] font-bold uppercase text-ink-muted">
                        De dónde visitó (Ciudad / Provincia / País)
                      </Text>
                      <Text className="text-xs font-bold text-ink">
                        {v.ubicaciones.join(" · ")}
                      </Text>
                    </View>

                    <View className="rounded-xl bg-surface-soft p-2.5">
                      <Text className="text-[10px] font-bold uppercase text-ink-muted">
                        Dispositivo / Navegador
                      </Text>
                      <Text className="text-xs font-bold text-ink">
                        {v.dispositivos.join(" · ") || "Web"}
                      </Text>
                    </View>

                    <View className="rounded-xl bg-surface-soft p-2.5">
                      <Text className="text-[10px] font-bold uppercase text-ink-muted">
                        Dirección IP / Secciones vistas
                      </Text>
                      <Text className="text-xs font-bold text-ink">
                        {[v.ips.join(", "), v.rutas.join(", ")].filter(Boolean).join(" · ") || "—"}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}
      </Screen>
    </View>
  );
}
