-- Migration: permitir lectura pública de ofertas activas para Open Graph y vistas compartidas

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ofertas' AND policyname = 'ofertas_select_public_activas'
  ) THEN
    CREATE POLICY "ofertas_select_public_activas"
    ON public.ofertas
    FOR SELECT
    TO anon, authenticated
    USING (estado = 'activa');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'oferta_media' AND policyname = 'oferta_media_select_public_activas'
  ) THEN
    CREATE POLICY "oferta_media_select_public_activas"
    ON public.oferta_media
    FOR SELECT
    TO anon, authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.ofertas o
        WHERE o.id = oferta_media.oferta_id AND o.estado = 'activa'
      )
    );
  END IF;
END $$;
