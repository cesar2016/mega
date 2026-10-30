import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { supabase } from "lib/supabase";
import { showToast } from "lib/utils";
import { Icon } from "components/ui/Icon";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient } from "components/ui/Screen";
import { Logo } from "components/ui/Logo";
import { BackgroundVideo } from "components/ui/BackgroundVideo";

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

function getEmailRedirectUrl(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/onboarding`;
  }
  return "mercado-ganadero://onboarding";
}

function traducirErrorAuth(raw?: string): string {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("email not confirmed")) {
    return "Todavía no confirmaste tu correo electrónico. Revisá tu bandeja de entrada (o spam) y abrí el enlace de validación.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (msg.includes("user already registered")) {
    return "Ya existe una cuenta registrada con este correo electrónico.";
  }
  if (msg.includes("email rate limit") || msg.includes("for security purposes")) {
    return "Esperá unos segundos antes de volver a solicitar el correo de confirmación.";
  }
  return raw || "No se pudo completar la operación";
}

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; returnUrl?: string }>();
  const [mode, setMode] = useState<Mode>(
    params.mode === "registro" ? "registro" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [emailPendiente, setEmailPendiente] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (params.mode === "registro" || params.mode === "login") {
      setMode(params.mode);
    }
  }, [params.mode]);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);

    if (mode === "registro" && nombre.trim().length < 2) {
      setError("Ingresá tu nombre y apellido (mínimo 2 caracteres)");
      return;
    }

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

        if (authError) {
          if ((authError.message ?? "").toLowerCase().includes("email not confirmed")) {
            setEmailPendiente(parsed.data.email);
          }
          throw authError;
        }
        setEmailPendiente(null);
        showToast("Sesión iniciada", "success");
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          // El trigger handle_new_user crea el profile con este nombre.
          options: {
            data: { nombre: parsed.data.nombre },
            emailRedirectTo: getEmailRedirectUrl(),
          },
        });

        if (signUpError) throw signUpError;

        // Cuando mailer_autoconfirm=false y el correo ya existe, Supabase devuelve identities vacío.
        if (
          data.user &&
          Array.isArray(data.user.identities) &&
          data.user.identities.length === 0
        ) {
          setError("Ya existe una cuenta con este correo electrónico. Iniciá sesión.");
          setMode("login");
          return;
        }

        if (data.session) {
          showToast("¡Cuenta creada!", "success");
        } else {
          setEmailPendiente(parsed.data.email);
          setInfo(
            `Te enviamos un correo de validación a ${parsed.data.email}. Abrí el enlace del email para activar tu cuenta y continuar.`
          );
          setMode("login");
        }
      }
    } catch (err: any) {
      setError(traducirErrorAuth(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const onReenviarConfirmacion = async () => {
    const destino = emailPendiente || email.trim();
    if (!destino) return;

    setReenviando(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: destino,
        options: {
          emailRedirectTo: getEmailRedirectUrl(),
        },
      });
      if (resendError) throw resendError;
      setInfo(`Reenviamos el correo de confirmación a ${destino}. Revisá tu bandeja de entrada.`);
      showToast("Correo de confirmación reenviado", "success");
    } catch (err: any) {
      setError(traducirErrorAuth(err?.message));
    } finally {
      setReenviando(false);
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
            colors={["#0F381E", "#15803D", "#0284C7", "#7E3F1C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="hidden w-[46%] max-w-xl flex-col justify-between gap-10 px-10 py-14 lg:flex"
          >
            <View className="flex-row items-center gap-3.5">
              <Logo size={52} className="rounded-full shadow-lg" />
              <View>
                <Text className="text-xl font-bold tracking-tight text-white">Mercado Ganadero</Text>
                <Text className="text-xs text-white/80">Compra y venta de hacienda</Text>
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

          {/* Formulario con fondo de video de hacienda en loop (15 segundos) */}
          <View className="relative flex-1 items-center justify-center overflow-hidden px-4 py-8 md:px-8 md:py-12">
            <BackgroundVideo />

            <View className="relative z-10 w-full max-w-md gap-6">
              {params.returnUrl ? (
                <Pressable
                  onPress={() => router.push(params.returnUrl as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Volver a la publicación"
                  className="flex-row items-center gap-2 self-start rounded-full border border-line-soft bg-white/95 px-3.5 py-2 shadow-sm active:bg-white"
                >
                  <Icon name="arrowLeft" size={14} className="text-ink-soft" />
                  <Text className="text-xs font-semibold text-ink-soft">
                    Volver a la publicación
                  </Text>
                </Pressable>
              ) : null}

              {/* Marca en mobile / tablet */}
              <View className="items-center gap-2 rounded-2xl border border-line-soft bg-white/90 px-4 py-3.5 shadow-sm lg:hidden">
                <Logo size={68} className="rounded-full shadow-md" />
                <Text className="text-center text-xl font-bold text-ink">Mercado Ganadero</Text>
                <Text className="text-center text-sm text-ink-muted">
                  {mode === "login" ? "Iniciá sesión para operar" : "Creá tu cuenta"}
                </Text>
              </View>

              <View className="hidden gap-1 rounded-2xl border border-line-soft bg-white/90 px-5 py-3.5 shadow-sm lg:flex">
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
              <View className="flex-row rounded-2xl border border-line bg-white p-1 shadow-sm">
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
                        activo ? "bg-sage-500 shadow-sm" : "active:bg-surface-sunk",
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

              <View className="gap-4 rounded-3xl border border-line-soft bg-white p-5 shadow-card md:p-7">
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

                {emailPendiente ? (
                  <Button
                    label="Reenviar correo de confirmación"
                    variant="soft"
                    size="sm"
                    icon="mail"
                    loading={reenviando}
                    disabled={loading || reenviando}
                    onPress={onReenviarConfirmacion}
                    fullWidth
                  />
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

              <View className="self-center rounded-full border border-line-soft bg-white/90 px-4 py-2 shadow-sm">
                <Text className="text-center text-sm font-medium text-ink-soft">
                  {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
                  <Text
                    onPress={() => cambiarModo(mode === "login" ? "registro" : "login")}
                    className="font-bold text-sage-600"
                  >
                    {mode === "login" ? "Registrate" : "Iniciá sesión"}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
