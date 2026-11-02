-- Migration: Campos completos de perfil y visibilidad pública del nombre de usuario para mostrar

-- 1. Agregar columnas faltantes en profiles para edición completa del perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nombre_completo TEXT,
  ADD COLUMN IF NOT EXISTS establecimiento TEXT,
  ADD COLUMN IF NOT EXISTS renspa TEXT,
  ADD COLUMN IF NOT EXISTS provincia TEXT,
  ADD COLUMN IF NOT EXISTS localidad TEXT,
  ADD COLUMN IF NOT EXISTS radio_km INTEGER DEFAULT 200;

-- 2. Sincronizar datos existentes desde productores y fleteros hacia profiles
UPDATE public.profiles p
SET
  establecimiento = COALESCE(p.establecimiento, pr.establecimiento),
  renspa = COALESCE(p.renspa, pr.renspa),
  cuit = COALESCE(p.cuit, pr.cuit)
FROM public.productores pr
WHERE p.id = pr.user_id;

UPDATE public.profiles p
SET
  radio_km = COALESCE(p.radio_km, fl.radio_km)
FROM public.fleteros fl
WHERE p.id = fl.user_id;

-- 3. Permitir lectura pública de profiles para que el nombre de usuario para mostrar
--    se visualice sin restricciones tanto para visitantes como para usuarios logueados
DROP POLICY IF EXISTS "perfiles_select_public" ON public.profiles;
CREATE POLICY "perfiles_select_public"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Permitir al propio usuario actualizar su perfil aunque esté recién registrado
DROP POLICY IF EXISTS "perfiles_update_own" ON public.profiles;
CREATE POLICY "perfiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
