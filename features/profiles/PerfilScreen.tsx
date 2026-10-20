import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuthStore } from "store/authStore";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Avatar } from "components/ui/Avatar";
import { Badge, Card } from "components/ui/Card";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient, Screen } from "components/ui/Screen";
import { MobileTopBar } from "components/layout/MobileTopBar";

const ROLE_LABEL: Record<string, string> = {
  productor: "Productor",
  comprador: "Comprador",
  fletero: "Transportista",
  admin: "Administrador",
};

const ROLE_ICON: Record<string, "tractor" | "shoppingCart" | "truck" | "shield"> = {
  productor: "tractor",
  comprador: "shoppingCart",
  fletero: "truck",
  admin: "shield",
};

function Dato({
  icon,
  label,
  value,
}: {
  icon: "user" | "shield" | "landmark" | "signal" | "mail" | "phone";
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
  const { profile, user, updateProfile, setUser } = useAuthStore();

  const [editing, setEditing] = React.useState(false);
  const [nombre, setNombre] = React.useState(profile?.nombre || "");
  const [telefono, setTelefono] = React.useState(profile?.telefono || "");
  const [avatarUrl, setAvatarUrl] = React.useState(profile?.avatar_url || "");
  const [saving, setSaving] = React.useState(false);

  const saveProfile = async () => {
    if (!nombre.trim()) {
      showToast("El nombre no puede quedar vacío", "error");
      return;
    }
    try {
      setSaving(true);
      await updateProfile({ nombre, telefono, avatar_url: avatarUrl });
      showToast("Perfil actualizado correctamente", "success");
      setEditing(false);
    } catch (err) {
      showToast("No se pudo actualizar el perfil", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-canvas">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-sm text-ink-muted">Cargando perfil...</Text>
      </View>
    );
  }

  const rol = profile.rol;

  return (
    <View className="flex-1 bg-canvas">
      <MobileTopBar title="Perfil" />

      <Screen
        eyebrow="Tu cuenta"
        title="Perfil"
        subtitle="Mantené tus datos al día para que la contraparte te pueda contactar."
        action={
          <Button
            label={editing ? "Cancelar" : "Editar perfil"}
            icon={editing ? "x" : "pencil"}
            variant={editing ? "secondary" : "primary"}
            onPress={() => setEditing(!editing)}
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
                  {profile.nombre || "Sin nombre"}
                </Text>
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
            onPress={() => setEditing(!editing)}
            accessibilityRole="button"
            className="flex-row items-center gap-2 self-start rounded-2xl border border-line bg-surface/80 px-3.5 py-2.5 active:bg-surface-sunk md:hidden"
          >
            <Icon name={editing ? "x" : "pencil"} size={16} className="text-ink-soft" />
            <Text className="text-sm font-semibold text-ink">
              {editing ? "Cancelar" : "Editar"}
            </Text>
          </Pressable>
        </Gradient>

        {editing ? (
          <Card className="gap-4">
            <Text className="text-base font-bold text-ink">Editar tus datos</Text>

            <Input
              label="Nombre completo"
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre completo"
              icon="user"
              autoCapitalize="words"
            />

            <Input
              label="Teléfono"
              value={telefono}
              onChangeText={setTelefono}
              placeholder="+54 9 11 1234-5678"
              keyboardType="phone-pad"
              icon="phone"
            />

            <Input
              label="URL del avatar (opcional)"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              placeholder="https://..."
              icon="image"
              autoCapitalize="none"
            />

            <View className="flex-row gap-3">
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
          <View className="gap-4">
            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
                Datos de la cuenta
              </Text>
              <View className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Dato icon="user" label="Nombre" value={profile.nombre || "—"} />
                <Dato icon="mail" label="Email" value={user.email ?? "—"} />
                <Dato
                  icon="shield"
                  label="Verificación"
                  value={profile.verificado ? "Sí, identidad validada" : "Pendiente"}
                />
                <Dato
                  icon="phone"
                  label="Teléfono"
                  value={profile.telefono || "Sin cargar"}
                />
                {rol === "productor" ? (
                  <Dato icon="landmark" label="CUIT" value={profile.cuit || "Sin cargar"} />
                ) : null}
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
                  Vas a salir de tu cuenta en este dispositivo.
                </Text>
              </View>
              <Button
                label="Salir"
                variant="danger"
                size="sm"
                onPress={() => setUser(null)}
              />
            </Card>
          </View>
        )}
      </Screen>
    </View>
  );
}
