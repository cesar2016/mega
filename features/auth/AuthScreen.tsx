import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { z } from "zod";
import { supabase } from "lib/supabase";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient } from "components/ui/Screen";

const AuthSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  nombre: z.string().min(2, "Nombre muy corto").optional(),
});

type Mode = "login" | "registro";

const BENEFICIOS = [
  { icon: "handshake" as const, title: "Match automático", text: "Cruces tu demanda con los lotes disponibles." },
  { icon: "shield" as const, title: "Perfiles verificados", text: "Productores y compradores con CUIT validado." },
  { icon: "truck" as const, title: "Flete coordinado", text: "Conectá con transportistas disponibles en tu radio." },
];

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);

    const parsed = AuthSchema.safeParse({
      email: email.trim(),
      password,
      nombre: mode === "registro" ? nombre.trim() : undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (authError) throw authError;
        showToast("Sesión iniciada", "success");
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          // El trigger handle_new_user crea el profile con este nombre.
          options: { data: { nombre: parsed.data.nombre } },
        });

        if (signUpError) throw signUpError;

        if (data.session) {
          showToast("¡Cuenta creada!", "success");
        } else {
          setInfo(
            "Cuenta creada. Revisá tu email para confirmar la cuenta y después iniciá sesión."
          );
          setMode("login");
        }
      }
    } catch (err: any) {
      const message = err?.message ?? "No se pudo completar la operación";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const cambiarModo = (nuevo: Mode) => {
    setMode(nuevo);
    setError(null);
    setInfo(null);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 flex-col lg:flex-row">
          {/* Panel de marca (escritorio) */}
          <Gradient
            colors={["#3E5645", "#5F8668", "#C4764F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="hidden w-[46%] max-w-xl flex-col justify-between gap-10 px-10 py-14 lg:flex"
          >
            <View className="flex-row items-center gap-3">
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <Icon name="sprout" size={24} className="text-white" />
              </View>
              <View>
                <Text className="text-lg font-bold text-white">Mercado Ganadero</Text>
                <Text className="text-sm text-white/70">Compra y venta de hacienda</Text>
              </View>
            </View>

            <View className="gap-6">
              <Text className="text-4xl font-extrabold leading-tight tracking-tight text-white">
                El mercado del{"\n"}ganado argentino.
              </Text>
              <Text className="max-w-md text-base leading-6 text-white/80">
                Publicá tus lotes, encontrá la hacienda que buscás y coordiná el flete
                en un solo lugar.
              </Text>

              <View className="gap-3">
                {BENEFICIOS.map((beneficio) => (
                  <View key={beneficio.title} className="flex-row items-start gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                      <Icon name={beneficio.icon} size={17} className="text-white" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-white">{beneficio.title}</Text>
                      <Text className="text-xs leading-5 text-white/70">{beneficio.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <Text className="text-xs text-white/60">
              © {new Date().getFullYear()} Mercado Ganadero · Córdoba, Argentina
            </Text>
          </Gradient>

          {/* Formulario */}
          <View className="flex-1 items-center justify-center px-4 py-8 md:px-8 md:py-12">
            <View className="w-full max-w-md gap-6">
              {/* Marca en mobile / tablet */}
              <View className="items-center gap-3 lg:hidden">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-sage-500">
                  <Icon name="sprout" size={26} className="text-white" />
                </View>
                <Text className="text-center text-xl font-bold text-ink">Mercado Ganadero</Text>
                <Text className="text-center text-sm text-ink-muted">
                  {mode === "login" ? "Iniciá sesión para operar" : "Creá tu cuenta"}
                </Text>
              </View>

              <View className="hidden gap-1 lg:flex">
                <Text className="text-xs font-bold uppercase tracking-[0.18em] text-sage-600">
                  {mode === "login" ? "Bienvenido" : "Sumate"}
                </Text>
                <Text className="text-2xl font-bold tracking-tight text-ink">
                  {mode === "login" ? "Iniciá sesión para operar" : "Creá tu cuenta"}
                </Text>
                <Text className="text-sm text-ink-muted">
                  {mode === "login"
                    ? "Ingresá con tu email y contraseña."
                    : "Tardás menos de un minuto."}
                </Text>
              </View>

              {/* Selector login / registro */}
              <View className="flex-row rounded-2xl border border-line bg-surface p-1">
                {(["login", "registro"] as Mode[]).map((valor) => {
                  const activo = mode === valor;
                  return (
                    <Pressable
                      key={valor}
                      onPress={() => cambiarModo(valor)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: activo }}
                      className={[
                        "flex-1 items-center rounded-xl py-2.5",
                        activo ? "bg-sage-500" : "active:bg-surface-sunk",
                      ].join(" ")}
                    >
                      <Text
                        className={[
                          "text-sm font-semibold",
                          activo ? "text-white" : "text-ink-soft",
                        ].join(" ")}
                      >
                        {valor === "login" ? "Iniciar sesión" : "Crear cuenta"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="gap-4 rounded-3xl border border-line-soft bg-surface p-5 shadow-soft md:p-7">
                {mode === "registro" ? (
                  <Input
                    label="Nombre y apellido"
                    value={nombre}
                    onChangeText={setNombre}
                    placeholder="Ej: Juan Pérez"
                    autoCapitalize="words"
                    icon="user"
                  />
                ) : null}

                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  icon="mail"
                />

                <Input
                  label="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  icon="lock"
                  hint={mode === "registro" ? "Mínimo 6 caracteres." : undefined}
                />

                {error ? (
                  <View className="flex-row items-start gap-2 rounded-2xl bg-clay-50 px-3.5 py-3">
                    <Icon name="alert" size={16} className="mt-0.5 text-clay-600" />
                    <Text className="flex-1 text-sm font-medium text-clay-700">{error}</Text>
                  </View>
                ) : null}

                {info ? (
                  <View className="flex-row items-start gap-2 rounded-2xl bg-sage-50 px-3.5 py-3">
                    <Icon name="info" size={16} className="mt-0.5 text-sage-600" />
                    <Text className="flex-1 text-sm font-medium text-sage-700">{info}</Text>
                  </View>
                ) : null}

                <Button
                  label={mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
                  onPress={onSubmit}
                  loading={loading}
                  size="lg"
                  fullWidth
                  iconRight="arrowRight"
                />
              </View>

              <Text className="text-center text-sm text-ink-muted">
                {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
                <Text
                  onPress={() => cambiarModo(mode === "login" ? "registro" : "login")}
                  className="font-semibold text-sage-600"
                >
                  {mode === "login" ? "Registrate" : "Iniciá sesión"}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
