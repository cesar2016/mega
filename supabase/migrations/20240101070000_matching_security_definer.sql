-- Migration: el matching automático no puede caerse por RLS + las partes pueden
-- aceptar/rechazar un match.
--
-- BUG: `calcular_matches_oferta` / `calcular_matches_demanda` corren con permisos
-- de invocante (SECURITY INVOKER). Los triggers de matching disparan dentro del
-- INSERT del cliente, así que el INSERT en `matches` lo ejecutaba el rol
-- `authenticated`, que no tiene política de INSERT sobre esa tabla:
--   "new row violates row-level security policy for table matches"
-- y la publicación del lote se caía entera (no se creaba la oferta).
--
-- FIX: las funciones de cálculo y los triggers pasan a SECURITY DEFINER con
-- `search_path` fijo y referencias calificadas con `public.` → el cálculo corre
-- como dueño de la tabla y la RLS no lo intercepta. El score lo calcula el
-- servidor: el cliente no puede forzar un puntaje.

-- ------------------------------------------------------------
-- Cálculo (idéntico al de 20240101020000_triggers_matching.sql)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_matches_oferta(p_oferta_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  o_row public.ofertas%ROWTYPE;
  r RECORD;
  v_score INTEGER;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO o_row FROM public.ofertas WHERE id = p_oferta_id;
  IF NOT FOUND OR o_row.estado <> 'activa' THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT
      d.id AS demanda_id,
      (
        CASE WHEN o_row.categoria = d.categoria THEN 30 ELSE 0 END +
        CASE WHEN o_row.raza IS NOT NULL AND o_row.raza = d.raza THEN 20 ELSE 0 END +
        CASE WHEN o_row.ubicacion IS NOT NULL AND d.ubicacion IS NOT NULL
              AND ST_DWithin(o_row.ubicacion::geography, d.ubicacion::geography, d.radio_km * 1000)
             THEN 30 ELSE 0 END +
        CASE WHEN o_row.peso_promedio IS NOT NULL AND d.peso_min_kg IS NOT NULL AND d.peso_max_kg IS NOT NULL
              AND ABS(o_row.peso_promedio - (d.peso_min_kg + d.peso_max_kg) / 2) <= 50
             THEN 15 ELSE 0 END +
        CASE WHEN d.precio_max IS NOT NULL AND ABS(o_row.precio - d.precio_max) <= 100 THEN 5 ELSE 0 END
      ) AS score
    FROM public.demandas d
    WHERE d.estado = 'activa'
  LOOP
    IF r.score >= 60 THEN
      INSERT INTO public.matches (oferta_id, demanda_id, puntaje, estado)
      VALUES (p_oferta_id, r.demanda_id, LEAST(100, r.score), 'pendiente')
      ON CONFLICT (oferta_id, demanda_id)
      DO UPDATE SET
        puntaje = GREATEST(public.matches.puntaje, EXCLUDED.puntaje),
        actualizado_en = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_matches_demanda(p_demanda_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d_row public.demandas%ROWTYPE;
  r RECORD;
  v_score INTEGER;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO d_row FROM public.demandas WHERE id = p_demanda_id;
  IF NOT FOUND OR d_row.estado <> 'activa' THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT
      o.id AS oferta_id,
      (
        CASE WHEN o.categoria = d_row.categoria THEN 30 ELSE 0 END +
        CASE WHEN o.raza IS NOT NULL AND o.raza = d_row.raza THEN 20 ELSE 0 END +
        CASE WHEN o.ubicacion IS NOT NULL AND d_row.ubicacion IS NOT NULL
              AND ST_DWithin(o.ubicacion::geography, d_row.ubicacion::geography, d_row.radio_km * 1000)
             THEN 30 ELSE 0 END +
        CASE WHEN o.peso_promedio IS NOT NULL AND d_row.peso_min_kg IS NOT NULL AND d_row.peso_max_kg IS NOT NULL
              AND ABS(o.peso_promedio - (d_row.peso_min_kg + d_row.peso_max_kg) / 2) <= 50
             THEN 15 ELSE 0 END +
        CASE WHEN d_row.precio_max IS NOT NULL AND ABS(o.precio - d_row.precio_max) <= 100 THEN 5 ELSE 0 END
      ) AS score
    FROM public.ofertas o
    WHERE o.estado = 'activa'
  LOOP
    IF r.score >= 60 THEN
      INSERT INTO public.matches (oferta_id, demanda_id, puntaje, estado)
      VALUES (r.oferta_id, p_demanda_id, LEAST(100, r.score), 'pendiente')
      ON CONFLICT (oferta_id, demanda_id)
      DO UPDATE SET
        puntaje = GREATEST(public.matches.puntaje, EXCLUDED.puntaje),
        actualizado_en = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- Triggers: también SECURITY DEFINER (borran y recalculan matches)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_matching_nuevo_oferta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.calcular_matches_oferta(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_matching_actualizar_oferta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.categoria IS DISTINCT FROM OLD.categoria OR
     NEW.raza IS DISTINCT FROM OLD.raza OR
     NEW.peso_promedio IS DISTINCT FROM OLD.peso_promedio OR
     NEW.precio IS DISTINCT FROM OLD.precio OR
     NEW.ubicacion IS DISTINCT FROM OLD.ubicacion OR
     NEW.estado IS DISTINCT FROM OLD.estado THEN
    DELETE FROM public.matches WHERE oferta_id = NEW.id;
    PERFORM public.calcular_matches_oferta(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_matching_nueva_demanda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.calcular_matches_demanda(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_matching_actualizar_demanda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.categoria IS DISTINCT FROM OLD.categoria OR
     NEW.raza IS DISTINCT FROM OLD.raza OR
     NEW.peso_min_kg IS DISTINCT FROM OLD.peso_min_kg OR
     NEW.peso_max_kg IS DISTINCT FROM OLD.peso_max_kg OR
     NEW.precio_max IS DISTINCT FROM OLD.precio_max OR
     NEW.radio_km IS DISTINCT FROM OLD.radio_km OR
     NEW.ubicacion IS DISTINCT FROM OLD.ubicacion OR
     NEW.estado IS DISTINCT FROM OLD.estado THEN
    DELETE FROM public.matches WHERE demanda_id = NEW.id;
    PERFORM public.calcular_matches_demanda(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- El cálculo sólo se dispara desde los triggers: se le cierra el paso directo.
REVOKE ALL ON FUNCTION public.calcular_matches_oferta(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_matches_demanda(UUID) FROM PUBLIC;

-- ------------------------------------------------------------
-- Las partes pueden marcar el match como aceptado / rechazado
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "matches_update_parties" ON matches;
CREATE POLICY "matches_update_parties" ON matches
  FOR UPDATE USING (
    public.email_confirmado() AND
    (oferta_id IN (
      SELECT id FROM public.ofertas WHERE productor_id = auth.uid()
    ) OR demanda_id IN (
      SELECT id FROM public.demandas WHERE comprador_id = auth.uid()
    ))
  )
  WITH CHECK (
    public.email_confirmado() AND
    (oferta_id IN (
      SELECT id FROM public.ofertas WHERE productor_id = auth.uid()
    ) OR demanda_id IN (
      SELECT id FROM public.demandas WHERE comprador_id = auth.uid()
    ))
  );

-- ------------------------------------------------------------
-- El puntaje y las referencias no se tocan desde el cliente:
-- sólo se puede cambiar `estado` (pendiente / aceptado / rechazado).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_match_inmutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner TEXT := (
    SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid = 'public.matches'::regclass
  );
BEGIN
  IF (NEW.oferta_id IS DISTINCT FROM OLD.oferta_id
      OR NEW.demanda_id IS DISTINCT FROM OLD.demanda_id
      OR NEW.puntaje IS DISTINCT FROM OLD.puntaje)
     AND current_user <> v_owner THEN
    RAISE EXCEPTION 'No se pueden modificar oferta_id, demanda_id ni puntaje de un match'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_protegidos ON matches;
CREATE TRIGGER matches_protegidos
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION public.proteger_match_inmutable();
