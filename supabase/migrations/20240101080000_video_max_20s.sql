-- ============================================================
-- Ampliar duración máxima de videos en oferta_media a 20 segundos
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'oferta_media'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%duracion_segundos%'
  LOOP
    EXECUTE format('ALTER TABLE public.oferta_media DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END$$;

ALTER TABLE public.oferta_media
  ADD CONSTRAINT oferta_media_duracion_segundos_check
  CHECK (duracion_segundos IS NULL OR (duracion_segundos >= 0 AND duracion_segundos <= 20));
