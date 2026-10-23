-- Migration: unificar el alta de usuarios de compra/venta de hacienda
-- manteniendo la figura diferenciada del fletero.
--
-- Todo usuario general (rol 'productor' o 'comprador') puede publicar tanto
-- ofertas de venta como demandas de compra, y cuenta con su fila en
-- public.productores para almacenar datos opcionales de verificación (CUIT, RENSPA).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, rol, onboarding_completado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1), 'Usuario'),
    'productor',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_rol_onboarding(
  p_user_id UUID,
  p_rol rol_usuario,
  p_datos_adicionales JSONB DEFAULT '{}'::jsonb
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No autorizado para modificar el perfil de otro usuario';
  END IF;

  UPDATE profiles
  SET rol = p_rol,
      nombre = COALESCE(p_datos_adicionales->>'nombre', nombre),
      telefono = COALESCE(p_datos_adicionales->>'telefono', telefono),
      updated_at = now()
  WHERE id = p_user_id;

  IF p_rol = 'fletero' THEN
    INSERT INTO fleteros (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO productores (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  RETURN v_profile;
END;
$$;

-- Asegura que todos los usuarios actuales que no son fleteros tengan su fila en productores.
INSERT INTO public.productores (user_id)
SELECT id FROM public.profiles
WHERE rol IN ('productor', 'comprador')
ON CONFLICT (user_id) DO NOTHING;
