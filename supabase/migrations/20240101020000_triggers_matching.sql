-- Migration: Triggers para matching instantáneo al crear/editar ofertas/demandas
-- Depende de 20240101000000_init_schema.sql (view + tabla matches + enums).

-- ------------------------------------------------------------
-- Helpers de cálculo
-- El trigger original referenciaba `o.categoria` dentro de un FROM que sólo
-- tenía `d`, y llamaba a una función de trigger con PERFORM (inválido).
-- Ahora el cálculo vive en funciones comunes que reciben el id por parámetro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calcular_matches_oferta(p_oferta_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  o_row ofertas%ROWTYPE;
  r RECORD;
  v_score INTEGER;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO o_row FROM ofertas WHERE id = p_oferta_id;
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
    FROM demandas d
    WHERE d.estado = 'activa'
  LOOP
    IF r.score >= 60 THEN
      INSERT INTO matches (oferta_id, demanda_id, puntaje, estado)
      VALUES (p_oferta_id, r.demanda_id, LEAST(100, r.score), 'pendiente')
      ON CONFLICT (oferta_id, demanda_id)
      DO UPDATE SET
        puntaje = GREATEST(matches.puntaje, EXCLUDED.puntaje),
        actualizado_en = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION calcular_matches_demanda(p_demanda_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  d_row demandas%ROWTYPE;
  r RECORD;
  v_score INTEGER;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO d_row FROM demandas WHERE id = p_demanda_id;
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
    FROM ofertas o
    WHERE o.estado = 'activa'
  LOOP
    IF r.score >= 60 THEN
      INSERT INTO matches (oferta_id, demanda_id, puntaje, estado)
      VALUES (r.oferta_id, p_demanda_id, LEAST(100, r.score), 'pendiente')
      ON CONFLICT (oferta_id, demanda_id)
      DO UPDATE SET
        puntaje = GREATEST(matches.puntaje, EXCLUDED.puntaje),
        actualizado_en = now();
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------
-- Triggers sobre ofertas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_matching_nuevo_oferta()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calcular_matches_oferta(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_matching_actualizar_oferta()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria IS DISTINCT FROM OLD.categoria OR
     NEW.raza IS DISTINCT FROM OLD.raza OR
     NEW.peso_promedio IS DISTINCT FROM OLD.peso_promedio OR
     NEW.precio IS DISTINCT FROM OLD.precio OR
     NEW.ubicacion IS DISTINCT FROM OLD.ubicacion OR
     NEW.estado IS DISTINCT FROM OLD.estado THEN
    DELETE FROM matches WHERE oferta_id = NEW.id;
    PERFORM calcular_matches_oferta(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oferta_nuevo_matching ON ofertas;
CREATE TRIGGER trigger_oferta_nuevo_matching
  AFTER INSERT ON ofertas
  FOR EACH ROW EXECUTE FUNCTION trigger_matching_nuevo_oferta();

DROP TRIGGER IF EXISTS trigger_oferta_actualizar_matching ON ofertas;
CREATE TRIGGER trigger_oferta_actualizar_matching
  AFTER UPDATE ON ofertas
  FOR EACH ROW
  WHEN (
    NEW.categoria IS DISTINCT FROM OLD.categoria OR
    NEW.raza IS DISTINCT FROM OLD.raza OR
    NEW.peso_promedio IS DISTINCT FROM OLD.peso_promedio OR
    NEW.precio IS DISTINCT FROM OLD.precio OR
    NEW.ubicacion IS DISTINCT FROM OLD.ubicacion OR
    NEW.estado IS DISTINCT FROM OLD.estado
  )
  EXECUTE FUNCTION trigger_matching_actualizar_oferta();

-- ------------------------------------------------------------
-- Triggers sobre demandas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_matching_nueva_demanda()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM calcular_matches_demanda(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_matching_actualizar_demanda()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria IS DISTINCT FROM OLD.categoria OR
     NEW.raza IS DISTINCT FROM OLD.raza OR
     NEW.peso_min_kg IS DISTINCT FROM OLD.peso_min_kg OR
     NEW.peso_max_kg IS DISTINCT FROM OLD.peso_max_kg OR
     NEW.precio_max IS DISTINCT FROM OLD.precio_max OR
     NEW.radio_km IS DISTINCT FROM OLD.radio_km OR
     NEW.ubicacion IS DISTINCT FROM OLD.ubicacion OR
     NEW.estado IS DISTINCT FROM OLD.estado THEN
    DELETE FROM matches WHERE demanda_id = NEW.id;
    PERFORM calcular_matches_demanda(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_demanda_nuevo_matching ON demandas;
CREATE TRIGGER trigger_demanda_nuevo_matching
  AFTER INSERT ON demandas
  FOR EACH ROW EXECUTE FUNCTION trigger_matching_nueva_demanda();

DROP TRIGGER IF EXISTS trigger_demanda_actualizar_matching ON demandas;
CREATE TRIGGER trigger_demanda_actualizar_matching
  AFTER UPDATE ON demandas
  FOR EACH ROW
  WHEN (
    NEW.categoria IS DISTINCT FROM OLD.categoria OR
    NEW.raza IS DISTINCT FROM OLD.raza OR
    NEW.peso_min_kg IS DISTINCT FROM OLD.peso_min_kg OR
    NEW.peso_max_kg IS DISTINCT FROM OLD.peso_max_kg OR
    NEW.precio_max IS DISTINCT FROM OLD.precio_max OR
    NEW.radio_km IS DISTINCT FROM OLD.radio_km OR
    NEW.ubicacion IS DISTINCT FROM OLD.ubicacion OR
    NEW.estado IS DISTINCT FROM OLD.estado
  )
  EXECUTE FUNCTION trigger_matching_actualizar_demanda();

-- Fin migration triggers_matching
