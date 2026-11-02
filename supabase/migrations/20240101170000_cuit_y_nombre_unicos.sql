-- Migration: CUIT y nombre de usuario únicos en profiles
-- 1. Agregar columna cuit en profiles si no existe
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cuit TEXT;

-- 2. Backfill desde productores si existe
UPDATE public.profiles p
SET cuit = pr.cuit
FROM public.productores pr
WHERE p.id = pr.user_id
  AND pr.cuit IS NOT NULL
  AND p.cuit IS NULL;

-- 3. Crear índices únicos parciales para CUIT y Nombre de usuario
DROP INDEX IF EXISTS profiles_cuit_unique_idx;
CREATE UNIQUE INDEX profiles_cuit_unique_idx
ON public.profiles (cuit)
WHERE cuit IS NOT NULL AND cuit <> '';

DROP INDEX IF EXISTS profiles_nombre_unique_idx;
CREATE UNIQUE INDEX profiles_nombre_unique_idx
ON public.profiles (LOWER(TRIM(nombre)))
WHERE nombre IS NOT NULL AND nombre <> '';

-- 4. Actualizar trigger handle_new_user para persistir CUIT desde metadatos de Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre TEXT;
  v_cuit TEXT;
BEGIN
  v_nombre := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre'), ''), split_part(NEW.email, '@', 1), 'Usuario');
  v_cuit := NULLIF(TRIM(NEW.raw_user_meta_data->>'cuit'), '');

  INSERT INTO public.profiles (id, nombre, cuit, rol, onboarding_completado)
  VALUES (
    NEW.id,
    v_nombre,
    v_cuit,
    'productor',
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    cuit = COALESCE(EXCLUDED.cuit, profiles.cuit);

  INSERT INTO public.productores (user_id, cuit)
  VALUES (NEW.id, v_cuit)
  ON CONFLICT (user_id) DO UPDATE SET
    cuit = COALESCE(EXCLUDED.cuit, productores.cuit);

  RETURN NEW;
END;
$$;

-- 5. Función RPC para verificar disponibilidad de Nombre de Usuario y CUIT (útil para validación en tiempo real en frontend)
CREATE OR REPLACE FUNCTION public.verificar_disponibilidad(
  p_nombre TEXT DEFAULT NULL,
  p_cuit TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre_existe BOOLEAN := FALSE;
  v_cuit_existe BOOLEAN := FALSE;
  v_nombre_norm TEXT;
  v_cuit_norm TEXT;
BEGIN
  IF p_nombre IS NOT NULL AND TRIM(p_nombre) <> '' THEN
    v_nombre_norm := LOWER(TRIM(p_nombre));
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE LOWER(TRIM(nombre)) = v_nombre_norm
        AND (p_user_id IS NULL OR id <> p_user_id)
    ) INTO v_nombre_existe;
  END IF;

  IF p_cuit IS NOT NULL AND TRIM(p_cuit) <> '' THEN
    v_cuit_norm := TRIM(p_cuit);
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE cuit = v_cuit_norm
        AND (p_user_id IS NULL OR id <> p_user_id)
      UNION
      SELECT 1 FROM public.productores
      WHERE cuit = v_cuit_norm
        AND (p_user_id IS NULL OR user_id <> p_user_id)
    ) INTO v_cuit_existe;
  END IF;

  RETURN jsonb_build_object(
    'nombre_disponible', NOT v_nombre_existe,
    'cuit_disponible', NOT v_cuit_existe
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_disponibilidad(TEXT, TEXT, UUID) TO anon, authenticated;
