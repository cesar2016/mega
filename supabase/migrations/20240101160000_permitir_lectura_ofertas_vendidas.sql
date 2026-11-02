-- Migration: permitir lectura pública de ofertas vendidas para la sección de lotes vendidos
DROP POLICY IF EXISTS "ofertas_select_public_activas" ON public.ofertas;
DROP POLICY IF EXISTS "ofertas_select_public_activas_y_vendidas" ON public.ofertas;

CREATE POLICY "ofertas_select_public_activas_y_vendidas"
ON public.ofertas
FOR SELECT
TO anon, authenticated
USING (estado IN ('activa'::estado_oferta, 'vendida'::estado_oferta));

DROP POLICY IF EXISTS "oferta_media_select_public_activas" ON public.oferta_media;
DROP POLICY IF EXISTS "oferta_media_select_public_activas_y_vendidas" ON public.oferta_media;

CREATE POLICY "oferta_media_select_public_activas_y_vendidas"
ON public.oferta_media
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ofertas o
    WHERE o.id = oferta_media.oferta_id
      AND o.estado IN ('activa'::estado_oferta, 'vendida'::estado_oferta)
  )
);
