import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useOnboarding } from "./useOnboarding";
import { Icon } from "components/ui/Icon";
import type { IconName } from "components/ui/Icon.types";
import { Button } from "components/ui/Button";
import { Input } from "components/ui/Input";
import { Gradient } from "components/ui/Screen";

const ROLES: {
  valor: "productor" | "comprador" | "fletero";
  titulo: string;
  descripcion: string;
  icon: IconName;
}[] = [
  {
    valor: "productor",
    titulo: "Productor",
    descripcion: "Vendo lotes de hacienda y quiero llegar a más compradores.",
    icon: "tractor",
  },
  {
    valor: "comprador",
    titulo: "Comprador",
    descripcion: "Busco hacienda para comprar, con matching automático por categoría y peso.",
    icon: "shoppingCart",
  },
  {
    valor: "fletero",
    titulo: "Fletero",
    descripcion: "Ofrezco transporte y quiero recibir pedidos de carga en mi radio.",
    icon: "truck",
  },
];

export default function OnboardingScreen() {
  const { step, formState, setFormState, isLoading, error, onStepChange, onSubmit } =
    useOnboarding();

  if (step === 3) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-6">
        <ActivityIndicator size="large" className="text-sage-500" />
        <Text className="text-base font-semibold text-ink">Guardando tu perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-1 items-center justify-center px-4 py-8 md:px-8 md:py-12">
        <View className="w-full max-w-2xl gap-7">
          {/* Encabezado */}
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-sage-500">
              <Icon name="sprout" size={26} className="text-white" />
            </View>
            <Text className="text-center text-2xl font-bold tracking-tight text-ink">
              {step === 1 ? "¡Bienvenido a Mercado Ganadero!" : "Completá tu perfil"}
            </Text>
            <Text className="max-w-md text-center text-sm leading-5 text-ink-muted">
              {step === 1
                ? "Elegí cómo vas a usar la plataforma. Después configuramos tus datos."
                : "Para conectarte con el mercado necesitamos saber quién sos."}
            </Text>
          </View>

          {/* Indicador de pasos */}
          <View className="flex-row items-center justify-center gap-2">
            {[1, 2].map((numero) => (
              <View
                key={numero}
                className={[
                  "h-1.5 rounded-full",
                  numero === step ? "w-10 bg-sage-500" : "w-6 bg-line",
                ].join(" ")}
              />
            ))}
          </View>

          {step === 1 ? (
            <View className="gap-3">
              {ROLES.map((rol) => {
                const activo = formState.rol === rol.valor;
                return (
                  <Pressable
                    key={rol.valor}
                    onPress={() => setFormState((prev) => ({ ...prev, rol: rol.valor }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activo }}
                    className={[
                      "flex-row items-center gap-4 rounded-3xl border bg-surface p-4",
                      activo ? "border-sage-400 bg-sage-50" : "border-line-soft",
                    ].join(" ")}
                  >
                    <View
                      className={[
                        "h-12 w-12 items-center justify-center rounded-2xl",
                        activo ? "bg-sage-500" : "bg-surface-sunk",
                      ].join(" ")}
                    >
                      <Icon
                        name={rol.icon}
                        size={22}
                        className={activo ? "text-white" : "text-ink-soft"}
                      />
                    </View>
                    <View className="flex-1 gap-1">
                      <Text
                        className={[
                          "text-base font-bold",
                          activo ? "text-sage-800" : "text-ink",
                        ].join(" ")}
                      >
                        {rol.titulo}
                      </Text>
                      <Text className="text-sm leading-5 text-ink-muted">{rol.descripcion}</Text>
                    </View>
                    <View
                      className={[
                        "h-6 w-6 items-center justify-center rounded-full border-2",
                        activo ? "border-sage-500 bg-sage-500" : "border-line",
                      ].join(" ")}
                    >
                      {activo ? <Icon name="check" size={13} className="text-white" /> : null}
                    </View>
                  </Pressable>
                );
              })}

              <Button
                label="Continuar"
                onPress={() => onStepChange(2)}
                loading={isLoading}
                size="lg"
                fullWidth
                iconRight="arrowRight"
                className="mt-2"
              />
            </View>
          ) : (
            <View className="gap-4 rounded-3xl border border-line-soft bg-surface p-5 shadow-soft md:p-7">
              <Input
                label="Nombre completo"
                value={formState.nombre}
                onChangeText={(text: string) => setFormState((prev) => ({ ...prev, nombre: text }))}
                placeholder="Ej: Juan Pérez"
                icon="user"
                autoCapitalize="words"
              />

              <Input
                label="Teléfono (opcional)"
                value={formState.telefono || ""}
                onChangeText={(text: string) =>
                  setFormState((prev) => ({ ...prev, telefono: text }))
                }
                placeholder="Ej: +54 9 11 1234-5678"
                keyboardType="phone-pad"
                icon="phone"
              />

              {error ? (
                <View className="flex-row items-start gap-2 rounded-2xl bg-clay-50 px-3.5 py-3">
                  <Icon name="alert" size={16} className="mt-0.5 text-clay-600" />
                  <Text className="flex-1 text-sm font-medium text-clay-700">{error}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <Button
                  label="Atrás"
                  variant="secondary"
                  onPress={() => onStepChange(1)}
                  className="flex-1"
                />
                <Button
                  label="Guardar y continuar"
                  onPress={onSubmit}
                  loading={isLoading}
                  className="flex-1"
                />
              </View>
            </View>
          )}

          <Gradient
            colors={["#E4EDE5", "#F8E6DA"]}
            className="flex-row items-center gap-3 rounded-3xl border border-line-soft px-4 py-3.5"
          >
            <Icon name="shield" size={18} className="text-sage-600" />
            <Text className="flex-1 text-xs leading-5 text-ink-soft">
              Tus datos se usan únicamente para coordonar compras y fletes dentro del mercado.
            </Text>
          </Gradient>
        </View>
      </View>
    </ScrollView>
  );
}
