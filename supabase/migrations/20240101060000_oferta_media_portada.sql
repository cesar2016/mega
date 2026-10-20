-- Portada de la oferta: la imagen que se muestra en la preview de la card.
-- Además, bucket de Storage + políticas para guardar fotos y videos de los lotes.

-- ===== oferta_media: columna de portada =====
ALTER TABLE oferta_media
  ADD COLUMN IF NOT EXISTS es_portada BOOLEAN NOT NULL DEFAULT false;

-- Una sola portada por oferta.
CREATE UNIQUE INDEX IF NOT EXISTS oferta_media_portada_unica
  ON oferta_media (oferta_id) WHERE es_portada;

-- El productor puede reordenar y quitar media de sus ofertas.
DROP POLICY IF EXISTS "oferta_media_update_owner" ON oferta_media;
CREATE POLICY "oferta_media_update_owner" ON oferta_media
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM ofertas o WHERE o.id = oferta_id AND o.productor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM ofertas o WHERE o.id = oferta_id AND o.productor_id = auth.uid()));

DROP POLICY IF EXISTS "oferta_media_delete_owner" ON oferta_media;
CREATE POLICY "oferta_media_delete_owner" ON oferta_media
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM ofertas o WHERE o.id = oferta_id AND o.productor_id = auth.uid()));

-- ===== Storage: bucket de medios de las ofertas =====
-- El bloque es tolerante a que el schema storage no exista (tests locales).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'oferta_media',
      'oferta_media',
      true,
      52428800,
      ARRAY[
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif',
        'image/heic', 'image/heif', 'image/gif', 'image/bmp',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/ogg'
      ]
    )
    ON CONFLICT (id) DO UPDATE
      SET public = EXCLUDED.public,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;

    EXECUTE 'DROP POLICY IF EXISTS "oferta_media_public_read" ON storage.objects';
    EXECUTE 'CREATE POLICY "oferta_media_public_read" ON storage.objects
      FOR SELECT USING (bucket_id = ''oferta_media'')';

    EXECUTE 'DROP POLICY IF EXISTS "oferta_media_owner_insert" ON storage.objects';
    EXECUTE 'CREATE POLICY "oferta_media_owner_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = ''oferta_media'' AND (storage.foldername(name))[1] = auth.uid()::text)';

    EXECUTE 'DROP POLICY IF EXISTS "oferta_media_owner_update" ON storage.objects';
    EXECUTE 'CREATE POLICY "oferta_media_owner_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = ''oferta_media'' AND (storage.foldername(name))[1] = auth.uid()::text)';

    EXECUTE 'DROP POLICY IF EXISTS "oferta_media_owner_delete" ON storage.objects';
    EXECUTE 'CREATE POLICY "oferta_media_owner_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = ''oferta_media'' AND (storage.foldername(name))[1] = auth.uid()::text)';
  END IF;
END $$;
