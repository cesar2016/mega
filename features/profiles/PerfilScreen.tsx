import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { useAuthStore, UserRol } from "store/authStore";
import { useAuthRedirect } from "lib/hooks/useAuthRedirect";
import { useMisOperaciones } from "lib/hooks/useOperaciones";
import {
  formatCuit,
  isValidCuitFormat,
  maskNombreUsuario,
  showToast,
  validarNombreUsuario,
} from "lib/utils";
import { Icon } from "components/ui/Icon";
import type { IconName } from "components/ui/Icon.types";
import { Avatar } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";

const ROLE_LABEL: Record<string, string> = {
  productor: "Compra y venta de hacienda",
  comprador: "Compra y venta de hacienda",
  fletero: "Transportista / Fletero",
  admin: "Administrador",
};

const ROLE_ICON: Record<string, "beef" | "truck" | "shield"> = {
  productor: "beef",
  comprador: "beef",
  fletero: "truck",
  admin: "shield",
};

function Dato({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-soft px-3.5 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface">
        <Icon name={icon} size={16} className="text-ink-soft" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </Text>
        <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function PerfilScreen() {
  const redirect = useAuthRedirect({ returnUrl: "/(main)/tabs/perfil" });
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, user, updateProfile, fetchProfile, signOut } = useAuthStore();
  const { data: operaciones } = useMisOperaciones(user?.id);
  const cantVentas = operaciones?.ventas.length ?? 0;
  const cantCompras = operaciones?.compras.length ?? 0;

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(profile?.nombre || "");
  const [nombreCompleto, setNombreCompleto] = useState(profile?.nombre_completo || "");
  const [cuit, setCuit] = useState(profile?.cuit || "");
  const [telefono, setTelefono] = useState(profile?.telefono || "");
  const [establecimiento, setEstablecimiento] = useState(profile?.establecimiento || "");
  const [renspa, setRenspa] = useState(profile?.renspa || "");
  const [provincia, setProvincia] = useState(profile?.provincia || "");
  const [localidad, setLocalidad] = useState(profile?.localidad || "");
  const [rolForm, setRolForm] = useState<UserRol>(profile?.rol || "productor");
  const [radioKm, setRadioKm] = useState(String(profile?.radio_km ?? 200));
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  useEffect(() => {
    if (profile && !editing) {
      setNombre(profile.nombre || "");
      setNombreCompleto(profile.nombre_completo || "");
      setCuit(profile.cuit || "");
      setTelefono(profile.telefono || "");
      setEstablecimiento(profile.establecimiento || "");
      setRenspa(profile.renspa || "");
      setProvincia(profile.provincia || "");
      setLocalidad(profile.localidad || "");
      setRolForm(profile.rol || "productor");
      setRadioKm(String(profile.radio_km ?? 200));
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile, editing]);

  if (redirect) return redirect;

  const handleToggleEdit = () => {
    setFormError(null);
    if (!editing && profile) {
      setNombre(profile.nombre || "");
      setNombreCompleto(profile.nombre_completo || "");
      setCuit(profile.cuit || "");
      setTelefono(profile.telefono || "");
      setEstablecimiento(profile.establecimiento || "");
      setRenspa(profile.renspa || "");
      setProvincia(profile.provincia || "");
      setLocalidad(profile.localidad || "");
      setRolForm(profile.rol || "productor");
      setRadioKm(String(profile.radio_km ?? 200));
      setAvatarUrl(profile.avatar_url || "");
    }
    setEditing(!editing);
  };

  const handleCerrarSesion = async () => {
    try {
      setCerrandoSesion(true);
      await signOut();
      queryClient.clear();
      showToast("Sesión cerrada correctamente", "info");
      router.replace("/");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      showToast("Error al cerrar sesión", "error");
    } finally {
      setCerrandoSesion(false);
    }
  };

  const saveProfile = async () => {
    setFormError(null);
    const nombreLimpio = nombre.trim();
    const cuitLimpio = cuit.trim();

    const errUsuario = validarNombreUsuario(nombreLimpio);
    if (errUsuario) {
      setFormError(errUsuario);
      showToast(errUsuario, "error");
      return;
    }

    if (cuitLimpio && !isValidCuitFormat(cuitLimpio)) {
      const msg = "El CUIT debe tener el formato 00-12345678-0 (11 dígitos con guiones).";
      setFormError(msg);
      showToast(msg, "error");
      return;
    }

    try {
      setSaving(true);

      // Verificar unicidad de nombre de usuario y CUIT si cambiaron
      if (isSupabaseConfigured && user?.id) {
        const { data: disp, error: dispError } = await supabase.rpc("verificar_disponibilidad", {
          p_nombre: nombreLimpio,
          p_cuit: cuitLimpio || null,
          p_user_id: user.id,
        });

        if (!dispError && disp) {
          if (!disp.nombre_disponible) {
            const msg = "Ese nombre de usuario ya está en uso. Elegí otro diferente.";
            setFormError(msg);
            showToast(msg, "error");
            setSaving(false);
            return;
          }
          if (cuitLimpio && !disp.cuit_disponible) {
            const msg = "Ese número de CUIT ya está registrado en otra cuenta.";
            setFormError(msg);
            showToast(msg, "error");
            setSaving(false);
            return;
          }
        }
      }

      const parsedRadio = parseInt(radioKm, 10);

      await updateProfile({
        nombre: nombreLimpio,
        nombre_completo: nombreCompleto.trim() || null,
        cuit: cuitLimpio || null,
        telefono: telefono.trim() || null,
        establecimiento: establecimiento.trim() || null,
        renspa: renspa.trim() || null,
        provincia: provincia.trim() || null,
        localidad: localidad.trim() || null,
        rol: rolForm,
        radio_km: !isNaN(parsedRadio) && parsedRadio > 0 ? parsedRadio : 200,
        avatar_url: avatarUrl.trim() || null,
      });

      await fetchProfile();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ofertas_activas"] }),
        queryClient.invalidateQueries({ queryKey: ["ofertas_vendidas"] }),
        queryClient.invalidateQueries({ queryKey: ["ofertas_productor"] }),
      ]);

      showToast("Perfil actualizado correctamente", "success");
      setEditing(false);
    } catch (err: any) {
      const msg = err?.message || "No se pudo actualizar el perfil";
      setFormError(msg);
      showToast(msg, "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) {
    return (
      <View className="flex-1 bg-canvas">
        <MobileTopBar title="Perfil" onBack={() => router.replace("/")} />
        <Screen
          eyebrow="Tu cuenta"
          title="Perfil"
          subtitle="Iniciá sesión o registrate para gestionar tus datos y publicaciones."
        >
          <Card className="items-center gap-3 py-8 text-center">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-sage-50">
              <Icon name="user" size={24} className="text-sage-600" />
            </View>
            <Text className="text-base font-bold text-ink">No has iniciado sesión</Text>
            <Text className="max-w-xs text-xs text-ink-muted">
              Ingresá a tu cuenta para ver tu información y configurar tus preferencias.
            </Text>
            <View className="mt-2 flex-row gap-2">
              <Button
                label="Iniciar sesión"
                variant="primary"
                onPress={() => router.push({ pathname: "/auth", params: { mode: "login" } })}
              />
              <Button
                label="Ir a la home"
                variant="secondary"
                icon="arrowLeft"
                onPress={() => router.replace("/")}
              />
            </View>
          </Card>
        </Screen>
      </View>
    );
  }

  const rol = profile.rol;
  const ubicacionTexto =
    [profile.localidad, profile.provincia].filter(Boolean).join(", ") || "Sin cargar";

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Perfil" />

      <Screen
        eyebrow="Tu cuenta"
        title="Perfil"
        subtitle={`En el mercado tu nombre de usuario público para mostrar es ${maskNombreUsuario(profile.nombre)}. Tus datos de contacto privados solo se comparten al concretar una operación.`}
        action={
          <Button
            label={editing ? "Cancelar" : "Editar perfil"}
            icon={editing ? "x" : "pencil"}
            variant={editing ? "secondary" : "primary"}
            onPress={handleToggleEdit}
            className="hidden md:flex"
          />
        }
      >
        {/* Cabecera */}
        <Gradient
          colors={["#E4EDE5", "#F8E6DA"]}
          className="flex-col gap-4 rounded-3xl border border-line-soft px-5 py-6 md:flex-row md:items-center md:gap-5 md:px-7"
        >
          <View className="flex-row items-center gap-4 md:min-w-0 md:flex-1">
            <Avatar uri={profile.avatar_url} nombre={profile.nombre} size={72} />
            <View className="min-w-0 flex-1 gap-2">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="text-xl font-extrabold tracking-tight text-ink">
                  {maskNombreUsuario(profile.nombre)}
                </Text>
                <Badge tone="sage" icon="user">
                  Nombre público visible
                </Badge>
                {profile.verificado ? (
                  <Badge tone="sage" icon="badgeCheck">
                    Verificado
                  </Badge>
                ) : null}
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Badge tone="clay" icon={ROLE_ICON[rol] ?? "user"}>
                  {ROLE_LABEL[rol] ?? rol}
                </Badge>
                <Text className="text-xs text-ink-muted" numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handleToggleEdit}
            accessibilityRole="button"
            className="flex-row items-center gap-2 self-start rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5 active:bg-surface-sunk md:hidden"
          >
            <Icon name={editing ? "x" : "pencil"} size={16} className="text-ink-soft" />
            <Text className="text-sm font-semibold text-ink">
              {editing ? "Cancelar" : "Editar perfil"}
            </Text>
          </Pressable>
        </Gradient>

        {editing ? (
          <Card className="gap-4">
            <View className="gap-1">
              <Text className="text-base font-bold text-ink">Editar datos del perfil</Text>
              <Text className="text-xs text-ink-muted">
                Completá o actualizá toda la información de tu cuenta.
              </Text>
            </View>

            <View className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Nombre de usuario para mostrar (único)"
                value={nombre}
                onChangeText={(t: string) => {
                  setNombre(t.replace(/\s+/g, ""));
                  setFormError(null);
                }}
                placeholder="Ej: Estancia_2026! o Ganadero#88"
                icon="user"
                autoCapitalize="none"
                autoCorrect={false}
                hint="Mín. 8 caracteres, sin espacios, con números y caracteres especiales."
              />

              <Input
                label="Nombre y apellido / Razón social"
                value={nombreCompleto}
                onChangeText={setNombreCompleto}
                placeholder="Ej: Juan Pérez / Agropecuaria S.A."
                icon="user"
                autoCapitalize="words"
                hint="Dato privado para tus operaciones de compra y venta."
              />

              <Input
                label="Número de CUIT (único)"
                value={cuit}
                onChangeText={(t: string) => {
                  setCuit(formatCuit(t));
                  setFormError(null);
                }}
                placeholder="00-12345678-0"
                keyboardType="numeric"
                maxLength={13}
                icon="shield"
                hint="Formato requerido: 00-12345678-0."
              />

              <Input
                label="Teléfono / WhatsApp"
                value={telefono}
                onChangeText={setTelefono}
                placeholder="+54 9 11 1234-5678"
                keyboardType="phone-pad"
                icon="phone"
              />

              <Input
                label="Establecimiento / Cabaña"
                value={establecimiento}
                onChangeText={setEstablecimiento}
                placeholder="Ej: Estancia San Martín"
                icon="landmark"
              />

              <Input
                label="Número de RENSPA"
                value={renspa}
                onChangeText={setRenspa}
                placeholder="Ej: 04.001.0.00123/00"
                icon="tag"
              />

              <Input
                label="Provincia"
                value={provincia}
                onChangeText={setProvincia}
                placeholder="Ej: Córdoba"
                icon="mapPin"
              />

              <Input
                label="Localidad"
                value={localidad}
                onChangeText={setLocalidad}
                placeholder="Ej: Río Cuarto"
                icon="mapPin"
              />
            </View>

            {/* Selector de actividad principal */}
            <View className="gap-2">
              <Text className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Actividad principal
              </Text>
              <View className="flex-row gap-2">
                {(
                  [
                    { id: "productor" as UserRol, label: "Compra y venta de hacienda", icon: "beef" as const },
                    { id: "fletero" as UserRol, label: "Transportista / Fletero", icon: "truck" as const },
                  ]
                ).map((item) => {
                  const active =
                    rolForm === item.id || (item.id === "productor" && rolForm === "comprador");
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setRolForm(item.id)}
                      className={[
                        "flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-3 py-3",
                        active
                          ? "border-sage-500 bg-sage-50"
                          : "border-line-soft bg-surface-soft",
                      ].join(" ")}
                    >
                      <Icon
                        name={item.icon}
                        size={16}
                        className={active ? "text-sage-700" : "text-ink-muted"}
                      />
                      <Text
                        className={[
                          "text-xs font-bold",
                          active ? "text-sage-800" : "text-ink-soft",
                        ].join(" ")}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {rolForm === "fletero" ? (
              <Input
                label="Radio de cobertura (km)"
                value={radioKm}
                onChangeText={(t: string) => setRadioKm(t.replace(/\D/g, ""))}
                placeholder="200"
                keyboardType="numeric"
                icon="signal"
              />
            ) : null}

            <Input
              label="URL del avatar (opcional)"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://..."
              icon="image"
              autoCapitalize="none"
            />

            {formError ? (
              <View className="flex-row items-start gap-2 rounded-2xl bg-clay-50 px-3.5 py-3">
                <Icon name="alert" size={16} className="mt-0.5 text-clay-600" />
                <Text className="flex-1 text-sm font-medium text-clay-700">{formError}</Text>
              </View>
            ) : null}

            <View className="flex-row gap-3 pt-1">
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={() => setEditing(false)}
                className="flex-1"
              />
              <Button
                label="Guardar cambios"
                onPress={saveProfile}
                loading={saving}
                className="flex-1"
              />
            </View>
          </Card>
        ) : (
          <View className="gap-5">
            {/* Accesos a Mis Ventas y Mis Compras */}
            <View className="gap-2.5">
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
                Operaciones Comerciales
              </Text>
              <View className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/tabs/ofertas",
                      params: { tab: "ventas" },
                    })
                  }
                  className="flex-row items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 p-4 active:bg-amber-100/70 cursor-pointer shadow-xs"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                      <Icon name="tag" size={20} className="text-amber-800" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-ink">Mis Ventas</Text>
                      <Text className="text-xs text-ink-muted">Lotes vendidos y compradores</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Badge tone="clay">{cantVentas}</Badge>
                    <Icon name="chevronRight" size={16} className="text-ink-muted" />
                  </View>
                </Pressable>

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(main)/tabs/ofertas",
                      params: { tab: "compras" },
                    })
                  }
                  className="flex-row items-center justify-between rounded-2xl border border-sage-200 bg-sage-50/70 p-4 active:bg-sage-100/70 cursor-pointer shadow-xs"
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-sage-100">
                      <Icon name="shoppingCart" size={20} className="text-sage-800" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-ink">Mis Compras</Text>
                      <Text className="text-xs text-ink-muted">Lotes adquiridos y productores</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Badge tone="sage">{cantCompras}</Badge>
                    <Icon name="chevronRight" size={16} className="text-ink-muted" />
                  </View>
                </Pressable>
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
                Datos de la cuenta
              </Text>
              <View className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Dato
                  icon="user"
                  label="Nombre de usuario (para mostrar)"
                  value={profile.nombre || "—"}
                />
                <Dato
                  icon="user"
                  label="Nombre y apellido / Razón social"
                  value={profile.nombre_completo || "Sin cargar"}
                />
                <Dato icon="mail" label="Email" value={user.email ?? "—"} />
                <Dato icon="landmark" label="CUIT" value={profile.cuit || "Sin cargar"} />
                <Dato
                  icon="phone"
                  label="Teléfono / WhatsApp"
                  value={profile.telefono || "Sin cargar"}
                />
                <Dato
                  icon="landmark"
                  label="Establecimiento / Cabaña"
                  value={profile.establecimiento || "Sin cargar"}
                />
                <Dato
                  icon="tag"
                  label="RENSPA"
                  value={profile.renspa || "Sin cargar"}
                />
                <Dato
                  icon="mapPin"
                  label="Ubicación"
                  value={ubicacionTexto}
                />
                <Dato
                  icon="shield"
                  label="Verificación"
                  value={profile.verificado ? "Sí, identidad validada" : "Pendiente"}
                />
                {rol === "fletero" ? (
                  <Dato
                    icon="signal"
                    label="Radio de cobertura"
                    value={profile.radio_km ? `${profile.radio_km} km` : "Sin cargar"}
                  />
                ) : null}
              </View>
            </View>

            <Card className="flex-row items-center gap-4">
              <View className="h-11 w-11 items-center justify-center rounded-2xl bg-clay-50">
                <Icon name="logOut" size={19} className="text-clay-600" />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-sm font-bold text-ink">Cerrar sesión</Text>
                <Text className="text-xs leading-5 text-ink-muted">
                  Vas a salir de tu cuenta en este dispositivo y volver a la home.
                </Text>
              </View>
              <Button
                label="Salir"
                variant="danger"
                size="sm"
                loading={cerrandoSesion}
                onPress={handleCerrarSesion}
              />
            </Card>
          </View>
        )}
      </Screen>
    </View>
  );
}
