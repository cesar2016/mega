-- Migration: Me gusta (favoritos), Visitas válidas (>30s) y bloqueo de edición de lotes vendidos

-- 1. Tabla de "Me gusta" (favoritos) públicos por publicación
CREATE TABLE IF NOT EXISTS public.oferta_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES public.ofertas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS oferta_likes_oferta_id_idx ON public.oferta_likes (oferta_id);

ALTER TABLE public.oferta_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oferta_likes_select_public" ON public.oferta_likes;
CREATE POLICY "oferta_likes_select_public"
  ON public.oferta_likes
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "oferta_likes_insert_public" ON public.oferta_likes;
CREATE POLICY "oferta_likes_insert_public"
  ON public.oferta_likes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "oferta_likes_delete_public" ON public.oferta_likes;
CREATE POLICY "oferta_likes_delete_public"
  ON public.oferta_likes
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- 2. Tabla de Visitas válidas (>30 segundos de permanencia en la publicación)
CREATE TABLE IF NOT EXISTS public.oferta_visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES public.ofertas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  visitor_id TEXT NOT NULL,
  duracion_segundos INTEGER NOT NULL DEFAULT 30 CHECK (duracion_segundos >= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oferta_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS oferta_visitas_oferta_id_idx ON public.oferta_visitas (oferta_id);

ALTER TABLE public.oferta_visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oferta_visitas_select_public" ON public.oferta_visitas;
CREATE POLICY "oferta_visitas_select_public"
  ON public.oferta_visitas
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "oferta_visitas_insert_public" ON public.oferta_visitas;
CREATE POLICY "oferta_visitas_insert_public"
  ON public.oferta_visitas
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (duracion_segundos >= 30);

DROP POLICY IF EXISTS "oferta_visitas_update_public" ON public.oferta_visitas;
CREATE POLICY "oferta_visitas_update_public"
  ON public.oferta_visitas
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (duracion_segundos >= 30);

-- 3. Trigger para impedir edición de ofertas que ya están en estado 'vendida' o 'completada'
CREATE OR REPLACE FUNCTION public.trg_bloquear_edicion_oferta_vendida()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado IN ('vendida', 'completada') THEN
    RAISE EXCEPTION 'No se puede editar una publicación que ya fue vendida.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bloquear_edicion_oferta_vendida ON public.ofertas;
CREATE TRIGGER bloquear_edicion_oferta_vendida
  BEFORE UPDATE ON public.ofertas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bloquear_edicion_oferta_vendida();
