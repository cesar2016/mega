import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { z } from "zod";
import { supabase } from "lib/supabase";
import { useAuthStore } from "store/authStore";
import { isValidCuitFormat } from "lib/utils";

const RoleSchema = z.enum(["productor", "comprador", "fletero"]);

// Esquema de onboarding: nombre de usuario, cuit, teléfono, rol
const OnboardingSchema = z.object({
  nombre: z.string().min(3, "Nombre de usuario muy corto (mínimo 3 caracteres)").max(30),
  cuit: z.string().refine((val) => !val || isValidCuitFormat(val), "El CUIT debe tener el formato 00-12345678-0").optional(),
  telefono: z.string().regex(/^[\d+\-\s()]*$/, "Teléfono inválido").optional(),
  rol: RoleSchema,
});

export type OnboardingFormValues = z.infer<typeof OnboardingSchema>;

export function useOnboarding() {
  const [step, setStep] = useState(1); // 1=rol, 2=datos, 3=completo
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const router = useRouter();

  const [formState, setFormState] = useState<OnboardingFormValues>({
    nombre: profile?.nombre || (user as any)?.user_metadata?.nombre || "",
    cuit: profile?.cuit || (user as any)?.user_metadata?.cuit || "",
    telefono: profile?.telefono || "",
    rol: "productor",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nombreInicial = profile?.nombre || (user as any)?.user_metadata?.nombre;
    const cuitInicial = profile?.cuit || (user as any)?.user_metadata?.cuit;
    if (nombreInicial || cuitInicial) {
      setFormState((prev) => ({
        ...prev,
        nombre: prev.nombre || nombreInicial || "",
        cuit: prev.cuit || cuitInicial || "",
      }));
    }
  }, [profile?.nombre, profile?.cuit, user]);

  // Si ya tiene perfil completo, redirigir
  useEffect(() => {
    if (!user) return;
    checkOnboardingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("onboarding_completado, rol, email_confirmed_at, nombre, cuit")
        .eq("id", user.id)
        .single();

      if (queryError) throw queryError;

      if (data?.nombre || data?.cuit) {
        setFormState((prev) => ({
          ...prev,
          nombre: prev.nombre || data.nombre || "",
          cuit: prev.cuit || data.cuit || "",
        }));
      }

      if (data?.onboarding_completado && data?.email_confirmed_at) {
        router.replace("/");
      } else {
        setStep(1);
      }
    } catch (e) {
      console.error("Error checking onboarding:", e);
      setStep(1);
    }
  };

  const onStepChange = (nextStep: number) => {
    setError(null);
    setStep(nextStep);
  };

  const onSubmit = async () => {
    try {
      const validated = OnboardingSchema.parse(formState);
      setIsLoading(true);
      setError(null);

      // Verificar unicidad de nombre y cuit
      const { data: disp, error: dispError } = await supabase.rpc("verificar_disponibilidad", {
        p_nombre: validated.nombre,
        p_cuit: validated.cuit || null,
        p_user_id: user?.id,
      });

      if (!dispError && disp) {
        if (!disp.nombre_disponible) {
          setError("El nombre de usuario ya está registrado. Elegí otro diferente.");
          setIsLoading(false);
          return;
        }
        if (validated.cuit && !disp.cuit_disponible) {
          setError("El número de CUIT ya se encuentra registrado por otro usuario.");
          setIsLoading(false);
          return;
        }
      }

      // 1. Registrar rol en la base de datos
      const { error: rolError } = await supabase.rpc("registrar_rol_onboarding", {
        p_user_id: user?.id,
        p_rol: validated.rol,
        p_datos_adicionales: JSON.stringify({
          nombre: validated.nombre,
          telefono: validated.telefono,
          cuit: validated.cuit,
        }),
      });

      if (rolError) throw rolError;

      // 2. Completar onboarding con datos adicionales
      const { error: completeError } = await supabase.rpc("completar_onboarding_perfil", {
        p_user_id: user?.id,
        p_nombre: validated.nombre,
        p_telefono: validated.telefono || "",
        p_rol_extra: null,
        p_avatar_url: null,
        p_tipo_usuario: validated.rol,
      });

      if (completeError) throw completeError;

      // 2b. Actualizar CUIT en profiles y productores
      if (validated.cuit) {
        await supabase
          .from("profiles")
          .update({ cuit: validated.cuit })
          .eq("id", user?.id);

        await supabase
          .from("productores")
          .upsert({ user_id: user?.id, cuit: validated.cuit });
      }

      // Refrescar el perfil: el guard de (main) lee onboarding_completado
      await fetchProfile();

      // 3. Navegar a pantalla principal
      setStep(3);
      await new Promise((r) => setTimeout(r, 1500));
      router.replace("/");
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setError(err?.message || "No se pudo completar el onboarding");
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    step,
    formState,
    setFormState,
    isLoading,
    error,
    onStepChange,
    onSubmit,
    checkOnboardingStatus,
  };
}
