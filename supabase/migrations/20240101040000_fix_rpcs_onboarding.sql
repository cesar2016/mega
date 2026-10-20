-- Migration: corregir los RPCs de onboarding
--
-- RETURN (SELECT * FROM profiles WHERE ...) falla con
-- "subquery must return only one column" al devolver una fila compuesta.
-- La forma correcta es SELECT ... INTO una variable del tipo de retorno.

CREATE OR REPLACE FUNCTION registrar_rol_onboarding(
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

  IF p_rol = 'productor' THEN
    INSERT INTO productores (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  ELSIF p_rol = 'fletero' THEN
    INSERT INTO fleteros (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION completar_onboarding_perfil(
  p_user_id UUID,
  p_nombre TEXT,
  p_telefono TEXT DEFAULT '',
  p_rol_extra TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_tipo_usuario TEXT DEFAULT NULL
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
  SET nombre = COALESCE(NULLIF(p_nombre, ''), nombre),
      telefono = NULLIF(p_telefono, ''),
      avatar_url = p_avatar_url,
      onboarding_completado = TRUE,
      updated_at = now()
  WHERE id = p_user_id;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  RETURN v_profile;
END;
$$;

-- Fin migration fix_rpcs_onboarding
