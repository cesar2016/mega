-- Migration: SuperAdmin exclusivo para Mega.Oficial_1 y analítica completa de visitas al sitio y usuarios registrados

-- 1. Asegurar que SOLO Mega.Oficial_1 tenga el rol 'admin' (SuperAdmin)
UPDATE public.profiles
SET rol = 'productor'
WHERE rol = 'admin'
  AND id <> '5446e68a-1482-452d-9bfe-e0bd3eb7d361'
  AND REPLACE(LOWER(TRIM(COALESCE(nombre, ''))), ' ', '') <> 'mega.oficial_1';

UPDATE public.profiles
SET rol = 'admin',
    updated_at = now()
WHERE id = '5446e68a-1482-452d-9bfe-e0bd3eb7d361'
   OR REPLACE(LOWER(TRIM(COALESCE(nombre, ''))), ' ', '') = 'mega.oficial_1';

-- Función helper para verificar si el usuario autenticado es el SuperAdmin (Mega.Oficial_1)
CREATE OR REPLACE FUNCTION public.es_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_es BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND (
        id = '5446e68a-1482-452d-9bfe-e0bd3eb7d361'
        OR REPLACE(LOWER(TRIM(COALESCE(nombre, ''))), ' ', '') = 'mega.oficial_1'
        OR rol = 'admin'
      )
  ) INTO v_es;

  RETURN COALESCE(v_es, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.es_super_admin(UUID) TO anon, authenticated;

-- 2. Tabla de visitas generales al sitio (quiénes, de dónde, cuántas veces y visitas repetidas)
CREATE TABLE IF NOT EXISTS public.sitio_visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  session_id TEXT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  usuario_nombre TEXT,
  ip TEXT,
  pais TEXT,
  provincia TEXT,
  ciudad TEXT,
  dispositivo TEXT,
  user_agent TEXT,
  ruta TEXT DEFAULT '/',
  referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sitio_visitas_visitor_id_idx ON public.sitio_visitas (visitor_id);
CREATE INDEX IF NOT EXISTS sitio_visitas_user_id_idx ON public.sitio_visitas (user_id);
CREATE INDEX IF NOT EXISTS sitio_visitas_created_at_idx ON public.sitio_visitas (created_at DESC);

ALTER TABLE public.sitio_visitas ENABLE ROW LEVEL SECURITY;

-- Cualquier visitante (anónimo o logueado) puede registrar su visita al entrar al sitio
DROP POLICY IF EXISTS "sitio_visitas_insert_public" ON public.sitio_visitas;
CREATE POLICY "sitio_visitas_insert_public"
  ON public.sitio_visitas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Solo el SuperAdmin puede leer el listado de visitas del sitio
DROP POLICY IF EXISTS "sitio_visitas_select_superadmin" ON public.sitio_visitas;
CREATE POLICY "sitio_visitas_select_superadmin"
  ON public.sitio_visitas
  FOR SELECT
  TO authenticated
  USING (public.es_super_admin(auth.uid()));

-- Permitir actualizar user_id / ubicación de la visita propia
DROP POLICY IF EXISTS "sitio_visitas_update_public" ON public.sitio_visitas;
CREATE POLICY "sitio_visitas_update_public"
  ON public.sitio_visitas
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Función RPC exclusiva de SuperAdmin para listar TODOS los usuarios registrados con email y métricas
CREATE OR REPLACE FUNCTION public.obtener_usuarios_superadmin()
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  nombre_completo TEXT,
  email TEXT,
  cuit TEXT,
  telefono TEXT,
  rol TEXT,
  establecimiento TEXT,
  renspa TEXT,
  provincia TEXT,
  localidad TEXT,
  verificado BOOLEAN,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  total_ofertas BIGINT,
  total_visitas_sitio BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.es_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acceso denegado: sección exclusiva para SuperAdmin (Mega.Oficial_1)';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nombre,
    p.nombre_completo,
    u.email::TEXT,
    p.cuit,
    p.telefono,
    p.rol::TEXT,
    COALESCE(p.establecimiento, pr.establecimiento) AS establecimiento,
    COALESCE(p.renspa, pr.renspa) AS renspa,
    p.provincia,
    p.localidad,
    COALESCE(pr.verificado, p.email_confirmed_at IS NOT NULL, false) AS verificado,
    COALESCE(p.email_confirmed_at, u.email_confirmed_at) AS email_confirmed_at,
    COALESCE(p.created_at, u.created_at) AS created_at,
    u.last_sign_in_at,
    (SELECT COUNT(*) FROM public.ofertas o WHERE o.productor_id = p.id) AS total_ofertas,
    (SELECT COUNT(*) FROM public.sitio_visitas sv WHERE sv.user_id = p.id) AS total_visitas_sitio
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.productores pr ON pr.user_id = p.id
  ORDER BY COALESCE(p.created_at, u.created_at) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_usuarios_superadmin() TO authenticated;

-- 4. Función RPC exclusiva de SuperAdmin para obtener todas las visitas al sitio enriquecidas con datos de usuario
CREATE OR REPLACE FUNCTION public.obtener_visitas_superadmin()
RETURNS TABLE (
  id UUID,
  visitor_id TEXT,
  session_id TEXT,
  user_id UUID,
  usuario_nombre TEXT,
  usuario_nombre_completo TEXT,
  usuario_email TEXT,
  ip TEXT,
  pais TEXT,
  provincia TEXT,
  ciudad TEXT,
  dispositivo TEXT,
  ruta TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.es_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acceso denegado: sección exclusiva para SuperAdmin (Mega.Oficial_1)';
  END IF;

  RETURN QUERY
  SELECT
    sv.id,
    sv.visitor_id,
    sv.session_id,
    sv.user_id,
    COALESCE(p.nombre, sv.usuario_nombre) AS usuario_nombre,
    p.nombre_completo AS usuario_nombre_completo,
    u.email::TEXT AS usuario_email,
    sv.ip,
    COALESCE(NULLIF(sv.pais, ''), 'Argentina') AS pais,
    COALESCE(NULLIF(sv.provincia, ''), p.provincia, 'Sin especificar') AS provincia,
    COALESCE(NULLIF(sv.ciudad, ''), p.localidad, 'Sin especificar') AS ciudad,
    COALESCE(NULLIF(sv.dispositivo, ''), 'Web / Móvil') AS dispositivo,
    COALESCE(NULLIF(sv.ruta, ''), '/') AS ruta,
    sv.created_at
  FROM public.sitio_visitas sv
  LEFT JOIN public.profiles p ON p.id = sv.user_id
  LEFT JOIN auth.users u ON u.id = sv.user_id
  ORDER BY sv.created_at DESC
  LIMIT 1000;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_visitas_superadmin() TO authenticated;
