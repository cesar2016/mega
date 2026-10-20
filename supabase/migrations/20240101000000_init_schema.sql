-- ============================================================
-- Mercado Ganadero - Migración inicial (schema base)
-- Conversión de supabase/schema.sql a migración corregida.
-- Debe aplicarse ANTES de las migraciones de matching.
-- ============================================================

-- ------------------------------------------------------------
-- Extensiones
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- ------------------------------------------------------------
-- Enums y tipos personalizados
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
    CREATE TYPE rol_usuario AS ENUM ('productor', 'comprador', 'fletero', 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_oferta') THEN
    CREATE TYPE estado_oferta AS ENUM ('activa', 'completada', 'cancelada', 'vencida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_demanda') THEN
    CREATE TYPE estado_demanda AS ENUM ('activa', 'completada', 'cancelada', 'vencida');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_match') THEN
    CREATE TYPE estado_match AS ENUM ('pendiente', 'aceptado', 'rechazado', 'finalizado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_precio') THEN
    CREATE TYPE tipo_precio AS ENUM ('por_kilo', 'por_cabeza', 'a_convenir');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_medio') THEN
    CREATE TYPE tipo_medio AS ENUM ('foto', 'video');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud_flete') THEN
    CREATE TYPE estado_solicitud_flete AS ENUM ('pendiente', 'ofrecida', 'aceptada', 'completada', 'cancelada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_vehiculo') THEN
    CREATE TYPE tipo_vehiculo AS ENUM ('camioneta', 'camion', 'furgoneta', 'otros');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'canal_notificacion') THEN
    CREATE TYPE canal_notificacion AS ENUM ('match', 'mensaje', 'oferta_flete', 'estado', 'system');
  END IF;
END$$;

-- ------------------------------------------------------------
-- Tablas principales
-- ------------------------------------------------------------

-- perfiles: datos extensos del usuario, linked a auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  avatar_url TEXT,
  rol rol_usuario NOT NULL DEFAULT 'comprador',
  estado TEXT DEFAULT 'activo',
  onboarding_completado BOOLEAN NOT NULL DEFAULT FALSE,
  email_aceptado TIMESTAMPTZ,
  email_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- productores: datos específicos del productor (CUIT, RENSPA, verificado)
CREATE TABLE IF NOT EXISTS productores (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cuit TEXT UNIQUE,
  renspa TEXT,
  establecimiento TEXT,
  verificado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ofertas: publicaciones de lotes de hacienda (productores)
CREATE TABLE IF NOT EXISTS ofertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  raza TEXT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  peso_promedio DECIMAL(10,2),
  edad TEXT,
  precio DECIMAL(12,2) NOT NULL,
  tipo_precio tipo_precio NOT NULL,
  descripcion TEXT,
  ubicacion geography(POINT, 4326),
  provincia TEXT NOT NULL,
  localidad TEXT,
  estado estado_oferta DEFAULT 'activa',
  vigencia TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- oferta_media: fotos y videos de las ofertas
CREATE TABLE IF NOT EXISTS oferta_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  tipo tipo_medio NOT NULL,
  url TEXT,
  duracion_segundos INTEGER CHECK (duracion_segundos <= 15),
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (oferta_id, tipo, orden)
);

-- demandas: búsquedas de compradores
CREATE TABLE IF NOT EXISTS demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  raza TEXT,
  cantidad_min INTEGER CHECK (cantidad_min > 0),
  cantidad_max INTEGER CHECK (cantidad_max >= cantidad_min),
  peso_min_kg DECIMAL(10,2) CHECK (peso_min_kg >= 0),
  peso_max_kg DECIMAL(10,2) CHECK (peso_max_kg >= peso_min_kg),
  precio_max DECIMAL(12,2) CHECK (precio_max >= 0),
  tipo_precio tipo_precio,
  ubicacion geography(POINT, 4326),
  provincia TEXT NOT NULL,
  localidad TEXT,
  radio_km INTEGER DEFAULT 150 CHECK (radio_km >= 0 AND radio_km <= 500),
  vigencia TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  estado estado_demanda DEFAULT 'activa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- matches: resultados del matching automático
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  demanda_id UUID NOT NULL REFERENCES demandas(id) ON DELETE CASCADE,
  puntaje INTEGER NOT NULL CHECK (puntaje >= 0 AND puntaje <= 100),
  estado estado_match DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE (oferta_id, demanda_id)
);

-- fleteros: perfiles de transportistas
CREATE TABLE IF NOT EXISTS fleteros (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  base_geography geography(POINT, 4326),
  radio_km INTEGER DEFAULT 200 CHECK (radio_km >= 0 AND radio_km <= 1000),
  verificado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- vehiculos: flota de cada fletero
CREATE TABLE IF NOT EXISTS vehiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fletero_id UUID NOT NULL REFERENCES fleteros(user_id) ON DELETE CASCADE,
  tipo tipo_vehiculo NOT NULL,
  capacidad_cabezas INTEGER CHECK (capacidad_cabezas > 0),
  patente TEXT,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- solicitudes_flete: cuando un productor solicita flete para una oferta
CREATE TABLE IF NOT EXISTS solicitudes_flete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  origen_geography geography(POINT, 4326),
  destino_geography geography(POINT, 4326),
  fecha_entrega TIMESTAMPTZ NOT NULL,
  cantidad_cabezas INTEGER NOT NULL CHECK (cantidad_cabezas > 0),
  descripcion TEXT,
  estado estado_solicitud_flete DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- ofertas_flete: ofertas de los fleteros para una solicitud
CREATE TABLE IF NOT EXISTS ofertas_flete (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL REFERENCES solicitudes_flete(id) ON DELETE CASCADE,
  fletero_id UUID NOT NULL REFERENCES fleteros(user_id) ON DELETE CASCADE,
  precio DECIMAL(12,2) NOT NULL,
  estado estado_solicitud_flete DEFAULT 'ofrecida',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE (solicitud_id, fletero_id)
);

-- push_tokens: tokens de push para notificaciones
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform)
);

-- notificaciones: registro de notificaciones enviadas
CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo canal_notificacion NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  entidad_tipo TEXT,
  entidad_id UUID,
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- reportes: reportes de contenido/usuarios
CREATE TABLE IF NOT EXISTS reportes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reportante_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entidad_tipo TEXT NOT NULL,
  entidad_id UUID NOT NULL,
  motivo TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- conversaciones: chats entre usuarios
CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID,
  demanda_id UUID,
  participante_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participante_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ultimo_mensaje_en TIMESTAMPTZ DEFAULT now(),
  creado_en TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT conversaciones_participantes_diferentes CHECK (participante_1 <> participante_2)
);

-- El UNIQUE original usaba COALESCE(...) dentro de la constraint, que Postgres
-- no permite. Postgres 15+ resuelve con UNIQUE NULLS NOT DISTINCT.
CREATE UNIQUE INDEX IF NOT EXISTS conversaciones_unico_idx
  ON conversaciones (participante_1, participante_2, COALESCE(oferta_id, demanda_id))
  NULLS NOT DISTINCT;

-- mensajes: mensajes individuales
CREATE TABLE IF NOT EXISTS mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cuerpo TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS ofertas_ubicacion_idx ON ofertas USING gist (ubicacion);
CREATE INDEX IF NOT EXISTS demandas_ubicacion_idx ON demandas USING gist (ubicacion);
CREATE INDEX IF NOT EXISTS fleteros_base_geography_idx ON fleteros USING gist (base_geography);
CREATE INDEX IF NOT EXISTS solicitudes_origen_idx ON solicitudes_flete USING gist (origen_geography);
CREATE INDEX IF NOT EXISTS solicitudes_destino_idx ON solicitudes_flete USING gist (destino_geography);

CREATE INDEX IF NOT EXISTS ofertas_categoria_estado_idx ON ofertas (categoria, estado);
CREATE INDEX IF NOT EXISTS demandas_categoria_radio_idx ON demandas (categoria, radio_km, estado);
CREATE INDEX IF NOT EXISTS matches_oferta_demanda_idx ON matches (oferta_id, demanda_id);
CREATE INDEX IF NOT EXISTS matches_puntaje_idx ON matches (puntaje);

CREATE INDEX IF NOT EXISTS ofertas_provincia_idx ON ofertas (provincia);
CREATE INDEX IF NOT EXISTS demandas_provincia_idx ON demandas (provincia);
CREATE INDEX IF NOT EXISTS ofertas_razas_idx ON ofertas (raza);
CREATE INDEX IF NOT EXISTS demandas_razas_idx ON demandas (raza);

CREATE INDEX IF NOT EXISTS profiles_rol_idx ON profiles (rol);
CREATE INDEX IF NOT EXISTS profiles_email_aceptado_idx ON profiles (email_aceptado);

CREATE INDEX IF NOT EXISTS oferta_media_oferta_orden_idx ON oferta_media (oferta_id, orden);

-- ------------------------------------------------------------
-- Triggers de timestamps
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ofertas_updated_at ON ofertas;
CREATE TRIGGER ofertas_updated_at BEFORE UPDATE ON ofertas FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS demandas_updated_at ON demandas;
CREATE TRIGGER demandas_updated_at BEFORE UPDATE ON demandas FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS perfiles_updated_at ON profiles;
CREATE TRIGGER perfiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
DROP TRIGGER IF EXISTS productores_updated_at ON productores;
CREATE TRIGGER productores_updated_at BEFORE UPDATE ON productores FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS matches_actualizado_en ON matches;
CREATE TRIGGER matches_actualizado_en BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION handle_actualizado_en();
DROP TRIGGER IF EXISTS fleteros_actualizado_en ON fleteros;
CREATE TRIGGER fleteros_actualizado_en BEFORE UPDATE ON fleteros FOR EACH ROW EXECUTE FUNCTION handle_actualizado_en();
DROP TRIGGER IF EXISTS vehiculos_actualizado_en ON vehiculos;
CREATE TRIGGER vehiculos_actualizado_en BEFORE UPDATE ON vehiculos FOR EACH ROW EXECUTE FUNCTION handle_actualizado_en();
DROP TRIGGER IF EXISTS solicitudes_flete_actualizado_en ON solicitudes_flete;
CREATE TRIGGER solicitudes_flete_actualizado_en BEFORE UPDATE ON solicitudes_flete FOR EACH ROW EXECUTE FUNCTION handle_actualizado_en();
DROP TRIGGER IF EXISTS ofertas_flete_actualizado_en ON ofertas_flete;
CREATE TRIGGER ofertas_flete_actualizado_en BEFORE UPDATE ON ofertas_flete FOR EACH ROW EXECUTE FUNCTION handle_actualizado_en();
DROP TRIGGER IF EXISTS reportes_actualizado_en ON reportes;
CREATE TRIGGER reportes_actualizado_en BEFORE UPDATE ON reportes FOR EACH ROW EXECUTE FUNCTION handle_actualizado_en();

-- ------------------------------------------------------------
-- Row Level Security
-- Toda política exige email confirmado (ver config.toml / auth settings).
--
-- OJO: con las claves nuevas de Supabase (sb_publishable_/sb_secret_) el JWT
-- ya NO trae el claim email_confirmed_at, así que auth.jwt()->>'email_confirmed_at'
-- siempre da NULL y las políticas bloquean todo. Por eso se usa esta función
-- SECURITY DEFINER que lee auth.users.email_confirmed_at (dato que el usuario
-- no puede falsear).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.email_confirmado()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  );
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE productores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE oferta_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleteros ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_flete ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofertas_flete ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- ===== profiles =====
DROP POLICY IF EXISTS "perfiles_select_confirmed" ON profiles;
CREATE POLICY "perfiles_select_confirmed" ON profiles
  FOR SELECT USING (public.email_confirmado());

DROP POLICY IF EXISTS "perfiles_insert_own" ON profiles;
CREATE POLICY "perfiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "perfiles_update_own" ON profiles;
CREATE POLICY "perfiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id AND public.email_confirmado());

-- ===== productores =====
DROP POLICY IF EXISTS "productores_select_confirmed" ON productores;
CREATE POLICY "productores_select_confirmed" ON productores
  FOR SELECT USING (public.email_confirmado());

DROP POLICY IF EXISTS "productores_insert_own" ON productores;
CREATE POLICY "productores_insert_own" ON productores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "productores_update_own" ON productores;
CREATE POLICY "productores_update_own" ON productores
  FOR UPDATE USING (auth.uid() = user_id);

-- ===== ofertas =====
DROP POLICY IF EXISTS "ofertas_select_confirmed" ON ofertas;
CREATE POLICY "ofertas_select_confirmed" ON ofertas
  FOR SELECT USING (public.email_confirmado());

DROP POLICY IF EXISTS "ofertas_insert_productor" ON ofertas;
CREATE POLICY "ofertas_insert_productor" ON ofertas
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    productor_id = auth.uid()
  );

DROP POLICY IF EXISTS "ofertas_update_productor" ON ofertas;
CREATE POLICY "ofertas_update_productor" ON ofertas
  FOR UPDATE USING (
    public.email_confirmado() AND
    productor_id = auth.uid()
  );

DROP POLICY IF EXISTS "ofertas_delete_productor" ON ofertas;
CREATE POLICY "ofertas_delete_productor" ON ofertas
  FOR DELETE USING (productor_id = auth.uid());

-- ===== oferta_media =====
DROP POLICY IF EXISTS "oferta_media_select_confirmed" ON oferta_media;
CREATE POLICY "oferta_media_select_confirmed" ON oferta_media
  FOR SELECT USING (public.email_confirmado());

DROP POLICY IF EXISTS "oferta_media_insert_owner" ON oferta_media;
CREATE POLICY "oferta_media_insert_owner" ON oferta_media
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ofertas o WHERE o.id = oferta_id AND o.productor_id = auth.uid())
  );

-- ===== demandas =====
DROP POLICY IF EXISTS "demandas_select_confirmed" ON demandas;
CREATE POLICY "demandas_select_confirmed" ON demandas
  FOR SELECT USING (public.email_confirmado());

DROP POLICY IF EXISTS "demandas_insert_comprador" ON demandas;
CREATE POLICY "demandas_insert_comprador" ON demandas
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    comprador_id = auth.uid()
  );

DROP POLICY IF EXISTS "demandas_update_comprador" ON demandas;
CREATE POLICY "demandas_update_comprador" ON demandas
  FOR UPDATE USING (
    public.email_confirmado() AND
    comprador_id = auth.uid()
  );

-- ===== matches =====
DROP POLICY IF EXISTS "matches_select_parties" ON matches;
CREATE POLICY "matches_select_parties" ON matches
  FOR SELECT USING (
    public.email_confirmado() AND
    (oferta_id IN (
      SELECT id FROM ofertas WHERE productor_id = auth.uid()
    ) OR demanda_id IN (
      SELECT id FROM demandas WHERE comprador_id = auth.uid()
    ))
  );

-- ===== fleteros =====
DROP POLICY IF EXISTS "fleteros_select_confirmed" ON fleteros;
CREATE POLICY "fleteros_select_confirmed" ON fleteros
  FOR SELECT USING (public.email_confirmado());

DROP POLICY IF EXISTS "fleteros_insert_own" ON fleteros;
CREATE POLICY "fleteros_insert_own" ON fleteros
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.email_confirmado());

DROP POLICY IF EXISTS "fleteros_update_own" ON fleteros;
CREATE POLICY "fleteros_update_own" ON fleteros
  FOR UPDATE USING (auth.uid() = user_id);

-- ===== vehiculos =====
DROP POLICY IF EXISTS "vehiculos_select_owner" ON vehiculos;
CREATE POLICY "vehiculos_select_owner" ON vehiculos
  FOR SELECT USING (
    public.email_confirmado() AND
    fletero_id IN (SELECT user_id FROM fleteros WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "vehiculos_insert_own" ON vehiculos;
CREATE POLICY "vehiculos_insert_own" ON vehiculos
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    fletero_id = auth.uid()
  );

-- ===== solicitudes_flete =====
-- El schema original referenciaba una columna fletero_id inexistente: el
-- fletero ve la solicitud si ofertó flete para ella.
DROP POLICY IF EXISTS "solicitudes_flete_select" ON solicitudes_flete;
CREATE POLICY "solicitudes_flete_select" ON solicitudes_flete
  FOR SELECT USING (
    public.email_confirmado() AND
    (
      solicitante_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM ofertas_flete of
        WHERE of.solicitud_id = solicitudes_flete.id AND of.fletero_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "solicitudes_flete_insert" ON solicitudes_flete;
CREATE POLICY "solicitudes_flete_insert" ON solicitudes_flete
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    solicitante_id = auth.uid()
  );

-- ===== ofertas_flete =====
DROP POLICY IF EXISTS "ofertas_flete_select" ON ofertas_flete;
CREATE POLICY "ofertas_flete_select" ON ofertas_flete
  FOR SELECT USING (
    public.email_confirmado() AND
    fletero_id = auth.uid()
  );

DROP POLICY IF EXISTS "ofertas_flete_insert" ON ofertas_flete;
CREATE POLICY "ofertas_flete_insert" ON ofertas_flete
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    fletero_id = auth.uid()
  );

-- ===== push_tokens =====
DROP POLICY IF EXISTS "push_tokens_select_own" ON push_tokens;
CREATE POLICY "push_tokens_select_own" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id AND public.email_confirmado());

DROP POLICY IF EXISTS "push_tokens_insert_own" ON push_tokens;
CREATE POLICY "push_tokens_insert_own" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.email_confirmado());

-- ===== notificaciones =====
DROP POLICY IF EXISTS "notificaciones_select_own" ON notificaciones;
CREATE POLICY "notificaciones_select_own" ON notificaciones
  FOR SELECT USING (auth.uid() = usuario_id AND public.email_confirmado());

DROP POLICY IF EXISTS "notificaciones_insert_system" ON notificaciones;
CREATE POLICY "notificaciones_insert_system" ON notificaciones
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    (auth.uid() = usuario_id OR auth.role() = 'service_role')
  );

-- ===== reportes =====
DROP POLICY IF EXISTS "reportes_select_own" ON reportes;
CREATE POLICY "reportes_select_own" ON reportes
  FOR SELECT USING (auth.uid() = reportante_id AND public.email_confirmado());

DROP POLICY IF EXISTS "reportes_insert_own" ON reportes;
CREATE POLICY "reportes_insert_own" ON reportes
  FOR INSERT WITH CHECK (
    auth.uid() = reportante_id AND public.email_confirmado()
  );

-- ===== conversaciones =====
DROP POLICY IF EXISTS "conversaciones_select_participants" ON conversaciones;
CREATE POLICY "conversaciones_select_participants" ON conversaciones
  FOR SELECT USING (
    public.email_confirmado() AND
    (participante_1 = auth.uid() OR participante_2 = auth.uid())
  );

-- ===== mensajes =====
DROP POLICY IF EXISTS "mensajes_select_conversation" ON mensajes;
CREATE POLICY "mensajes_select_conversation" ON mensajes
  FOR SELECT USING (
    public.email_confirmado() AND
    conversacion_id IN (
      SELECT id FROM conversaciones WHERE participante_1 = auth.uid() OR participante_2 = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mensajes_insert_own" ON mensajes;
CREATE POLICY "mensajes_insert_own" ON mensajes
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    remitente_id = auth.uid() AND
    conversacion_id IN (
      SELECT id FROM conversaciones WHERE participante_1 = auth.uid() OR participante_2 = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Perfil automático al registrarse
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, rol, onboarding_completado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1), 'Usuario'),
    'comprador',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Sincroniza profiles.email_confirmed_at cuando Auth confirma el email.
CREATE OR REPLACE FUNCTION handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE profiles
    SET email_confirmed_at = NEW.email_confirmed_at,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_user_confirmed();

-- ------------------------------------------------------------
-- RPCs de onboarding (los llama features/onboarding/useOnboarding.ts)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_rol_onboarding(
  p_user_id UUID,
  p_rol rol_usuario,
  p_datos_adicionales JSONB DEFAULT '{}'::jsonb
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No autorizado para modificar el perfil de otro usuario';
  END IF;

  UPDATE profiles
  SET rol = p_rol,
      nombre = COALESCE(p_datos_adicionales->>'nombre', nombre),
      telefono = COALESCE(p_datos_adicionales->>'telefono', telefono),
      updated_at = now()
  WHERE id = p_user_id;

  IF p_rol = 'productor' THEN
    INSERT INTO productores (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  ELSIF p_rol = 'fletero' THEN
    INSERT INTO fleteros (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION completar_onboarding_perfil(
  p_user_id UUID,
  p_nombre TEXT,
  p_telefono TEXT DEFAULT '',
  p_rol_extra TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_tipo_usuario TEXT DEFAULT NULL
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'No autorizado para modificar el perfil de otro usuario';
  END IF;

  UPDATE profiles
  SET nombre = COALESCE(NULLIF(p_nombre, ''), nombre),
      telefono = NULLIF(p_telefono, ''),
      avatar_url = p_avatar_url,
      onboarding_completado = TRUE,
      updated_at = now()
  WHERE id = p_user_id;

  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  RETURN v_profile;
END;
$$;

-- ------------------------------------------------------------
-- View: matching básico (ejemplo de consulta PostGIS ST_DWithin)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW view_matching_candidatos AS
SELECT
  o.id AS oferta_id,
  o.productor_id,
  o.categoria,
  o.raza,
  o.cantidad,
  o.peso_promedio,
  o.precio,
  o.tipo_precio,
  d.id AS demanda_id,
  d.comprador_id,
  d.categoria AS demand_categoria,
  d.raza AS demand_raza,
  d.cantidad_min,
  d.cantidad_max,
  d.peso_min_kg,
  d.peso_max_kg,
  d.precio_max,
  d.radio_km,
  ST_Distance(o.ubicacion::geography, d.ubicacion::geography) / 1000 AS distancia_km,
  (
    CASE WHEN o.categoria = d.categoria THEN 30 ELSE 0 END +
    CASE WHEN o.raza IS NOT NULL AND o.raza = d.raza THEN 20 ELSE 0 END +
    CASE WHEN o.ubicacion IS NOT NULL AND d.ubicacion IS NOT NULL
          AND ST_DWithin(o.ubicacion::geography, d.ubicacion::geography, d.radio_km * 1000)
         THEN 30 ELSE 0 END +
    CASE WHEN o.peso_promedio IS NOT NULL AND d.peso_min_kg IS NOT NULL AND d.peso_max_kg IS NOT NULL
          AND ABS(o.peso_promedio - (d.peso_min_kg + d.peso_max_kg) / 2) <= 50
         THEN 15 ELSE 0 END +
    CASE WHEN d.precio_max IS NOT NULL AND ABS(o.precio - d.precio_max) <= 100 THEN 5 ELSE 0 END
  ) AS puntaje_base
FROM ofertas o
JOIN demandas d ON d.estado = 'activa' AND o.estado = 'activa'
WHERE o.categoria = d.categoria;

COMMENT ON TABLE profiles IS 'Perfil del usuario linked a auth.users, con rol y estado de email confirmado';
COMMENT ON TABLE ofertas IS 'Publicaciones de lotes de hacienda por productores';
COMMENT ON TABLE demandas IS 'Demandas de compradores con radio de búsqueda';
COMMENT ON TABLE matches IS 'Matching automático entre ofertas y demandas';
COMMENT ON TABLE ofertas_flete IS 'Ofertas de flete por parte de fleteros';
COMMENT ON POLICY "perfiles_select_confirmed" ON profiles IS 'Solo usuarios con email confirmado pueden leer perfiles';
-- Fin migración inicial
