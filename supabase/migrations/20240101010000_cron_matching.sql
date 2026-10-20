-- Migration: Setup pg_cron extension and periodic matching recalibration
-- pg_cron debe estar habilitado en el proyecto (Dashboard > Extensions > pg_cron).
-- Si no lo está, la migración NO falla: se avisa y se sigue.

-- 2.1. Habilitar pg_cron (idempotente y tolerante a fallos)
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron no está habilitado en este proyecto: se omiten los jobs de cron. Habilitalo en Dashboard > Extensions.';
  END;
END$$;

-- 2.2. Función auxiliar: refresh matching via trigger SQL interno
CREATE OR REPLACE FUNCTION handle_matching_refresh()
RETURNS VOID AS $$
DECLARE
  candidate_rec RECORD;
BEGIN
  FOR candidate_rec IN
    SELECT * FROM view_matching_candidatos
  LOOP
    -- El original concatenaba puntaje_base || 5 (texto) en vez de sumar.
    INSERT INTO matches (oferta_id, demanda_id, puntaje, estado, actualizado_en)
    VALUES (candidate_rec.oferta_id, candidate_rec.demanda_id,
            LEAST(100, candidate_rec.puntaje_base + 5),
            'pendiente', now())
    ON CONFLICT (oferta_id, demanda_id)
    DO UPDATE SET
      puntaje = LEAST(100, GREATEST(matches.puntaje, candidate_rec.puntaje_base + 5)),
      actualizado_en = now();
  END LOOP;

  -- Limpiar matches con puntaje muy bajo (< 20) que probablemente no convergan
  DELETE FROM matches WHERE puntaje < 20 AND actualizado_en < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;

-- 2.3. Cron job: recalcular matching cada 15 minutos
-- El bloque usa $cron$ (y no $$) porque el cuerpo de cron.schedule lleva $$ anidados.
DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron no disponible: no se registran los cron jobs.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'refine-matching-every-15-min',
    '*/15 * * * *',
    'SELECT handle_matching_refresh();'
  );

  PERFORM cron.schedule(
    'cleanup-old-matches-and-reports',
    '0 2 * * *',
    $job$
      DELETE FROM matches m
      USING ofertas o, demandas d
      WHERE m.oferta_id = o.id AND o.estado <> 'activa'
         OR m.demanda_id = d.id AND d.estado = 'vencida';

      DELETE FROM reportes WHERE estado = 'resuelto'
        AND creado_en < now() - interval '30 days';
    $job$
  );
END$cron$;
-- Fin migration cron_matching
