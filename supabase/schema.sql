-- ============================================================
-- Mercado Ganadero - Schema SQL completo
-- PostGIS, extensiones, tipos y políticas RLS
-- ============================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- ============================================================
-- Enums y tipos personalizados
-- ============================================================

CREATE TYPE rol_usuario AS ENUM ('productor', 'comprador', 'fletero', 'admin');
CREATE TYPE estado_oferta AS ENUM ('activa', 'completada', 'cancelada', '_vencida');
CREATE TYPE estado_demanda AS ENUM ('activa', 'completada', 'cancelada', 'vencida');
CREATE_TYPE estado_match AS ENUM ('pendiente', 'aceptado', ' rechazado', 'finalizado');
CREATE TYPE tipo_precio AS ENUM ('por_kilo', 'por_cabeza', 'a_convenir');
CREATE TYPE tipo_medio AS ENUM ('foto', 'video');
CREATE TYPE estado_solicitud_flete AS ENUM ('pendiente', 'ofrecida', 'aceptada', 'completada', 'cancelada');
CREATE TYPE tipo_vehiculo AS ENUM ('camioneta', 'camion', 'furgoneta', 'otros');
CREATE TYPE canal_notificacion AS ENUM ('match', 'mensaje', 'oferta_flete', 'estado', 'system');

-- ============================================================
-- Tablas principales
-- ============================================================

-- perfiles: datos extensos del usuario, linked a auth.users
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  avatar_url TEXT,
  rol rol_usuario NOT NULL DEFAULT 'comprador',
  estado TEXT DEFAULT 'activo',
  email_aceptado TIMESTAMPTZ, -- fecha de aceptación de términos
  email_confirmed_at TIMESTAMPTZ, -- fillado por Supabase Auth
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_roles: flags multirol (opcional tabla separada si se necesita N:N)
-- Nota: usamos columnas booleanas en profiles + el enum rol para simplicidad MVP
-- Si se necesita muchos-muchos: tabla user_roles (user_id, rol) con PK compuesta

-- productores: datos específicos del productor (CUIT, RENSPA, verificado)
CREATE TABLE productores (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cuit TEXT UNIQUE,
  renspa TEXT,
  establecimiento TEXT,
  verificado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ofertas: publicaciones de lotes de hacienda (productores)
CREATE TABLE ofertas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  productor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, -- novillos, vaquillonas, terneros, vacas, toros, etc.
  raza TEXT,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  peso_promedio DECIMAL(10,2), -- en kg
  edad TEXT, -- 'a destete', 'termina', 'adulto', etc.
  precio DECIMAL(12,2) NOT NULL,
  tipo_precio tipo_precio NOT NULL,
  descripcion TEXT,
  ubicacion geography(POINT, 4326), -- punto del campo (longitude, latitude)
  provincia TEXT NOT NULL,
  localidad TEXT,
  estado estado_oferta DEFAULT 'activa',
  vigencia TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- oferta_media: fotos y videos de las ofertas (hasta 8 fotos + 1-2 videos)
CREATE TABLE oferta_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  tipo tipo_medio NOT NULL,
  url TEXT, -- URL pública o mux_asset_id
  duracion_segundos INTEGER CHECK (duracion_segundos <= 15), -- solo para video
  orden INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (oferta_id, tipo, orden)
);

-- demandas: búsquedas de compradores
CREATE TABLE demandas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comprador_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL,
  raza TEXT,
  cantidad_min INTEGER CHECK (cantidad_min > 0),
  cantidad_max INTEGER CHECK (cantidad_max >= cantidad_min),
  peso_min_kg DECIMAL(10,2) CHECK (peso_min_kg >= 0),
  peso_max_kg DECIMAL(10,2) CHECK (peso_max_kg >= peso_min_kg),
  precio_max DECIMAL(12,2) CHECK (precio_max >= 0),
  tipo_precio tipo_precio,
  ubicacion geography(POINT, 4326), -- ubicación de interés (punto)
  provincia TEXT NOT NULL,
  localidad TEXT,
  radio_km INTEGER DEFAULT 150 CHECK (radio_km >= 0 AND radio_km <= 500),
  vigencia TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  estado estado_demanda DEFAULT 'activa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- matches: resultados del matching automático
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oferta_id UUID NOT NULL REFERENCES ofertas(id) ON DELETE CASCADE,
  demanda_id UUID NOT NULL REFERENCES demandas(id) ON DELETE CASCADE,
  puntaje INTEGER NOT NULL CHECK (puntaje >= 0 AND puntaje <= 100),
  estado estado_match DEFAULT 'pendiente',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE (oferta_id, demanda_id) -- un match por par oferta-demanda
);

-- fleteros: perfiles de transportistas
CREATE TABLE fleteros (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  base_geography geography(POINT, 4326), -- ubicación base (geography computed from lat/lng)
  radio_km INTEGER DEFAULT 200 CHECK (radio_km >= 0 AND radio_km <= 1000),
  verificado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- vehiculos: flota de cada fletero
CREATE TABLE vehiculos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fletero_id UUID NOT NULL REFERENCES fleteros(user_id) ON DELETE CASCADE,
  tipo tipo_vehiculo NOT NULL,
  capacidad_cabezas INTEGER CHECK (capacidad_cabezas > 0),
  patente TEXT,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- solicitudes_flete: cuando un productor solicita flete para una oferta
CREATE TABLE solicitudes_flete (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE ofertas_flete (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solicitud_id UUID NOT NULL REFERENCES solicitudes_flete(id) ON DELETE CASCADE,
  fletero_id UUID NOT NULL REFERENCES fleteros(user_id) ON DELETE CASCADE,
  precio DECIMAL(12,2) NOT NULL,
  estado estado_solicitud_flete DEFAULT 'ofrecida',
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE (solicitud_id, fletero_id)
);

-- push_tokens: tokens de push para notificaciones
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android', -- android | ios | web
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, platform)
);

-- notificaciones: registro de notificaciones enviadas
CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo canal_notificacion NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  entidad_tipo TEXT, -- 'oferta' | 'demanda' | 'match' | 'solicitud_flete' | 'oferta_flete'
  entidad_id UUID,
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- reportes: reportes de contenido/usuarios
CREATE TABLE reportes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reportante_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entidad_tipo TEXT NOT NULL, -- 'oferta' | 'demanda' | 'usuario' | 'match' | 'solicitud_flete'
  entidad_id UUID NOT NULL,
  motivo TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'resuelto', 'descartado'
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- conversaciones: chats entre usuarios (productor-comprador, productor-fletero)
-- Simplificado: usamos mensajeria directa por Realtime; esta tabla es solo tracking
CREATE TABLE conversaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oferta_id UUID, -- nullable si es chat directo usuario-comprador
  demanda_id UUID,
  participante_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participante_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ultimo_mensaje_en TIMESTAMPTZ DEFAULT now(),
  creado_en TIMESTAMPTZ DEFAULT now(),
  UNIQUE (participante_1, participante_2, COALESCE(oferta_id, demanda_id))
);

-- mensajes: mensajes individuales (el flujo real es via Supabase Realtime channels,
-- esta tabla opcional guarda historial si se quiere persistencia local)
CREATE TABLE mensajes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cuerpo TEXT NOT NULL,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Índices de performance
-- ============================================================

-- Índices GIST para consultas geográficas (PostGIS)
CREATE INDEX ofertas_ubicacion_idx ON ofertas USING gist (ubicacion);
CREATE INDEX demandas_ubicacion_idx ON demandas USING gist (ubicacion);
CREATE INDEX fleteros_base_geography_idx ON fleteros USING gist (base_geography);
CREATE INDEX solicitudes_origen_idx ON solicitudes_flete USING gist (origen_geography);
CREATE INDEX solicitudes_destino_idx ON solicitudes_flete USING gist (destino_geography);

-- Índices compuestos para matching
CREATE INDEX ofertas_categoria_estado_idx ON ofertas (categoria, estado);
CREATE INDEX demandas_categoria_radio_idx ON demandas (categoria, radio_km, estado);
CREATE INDEX matches_oferta_demanda_idx ON matches (oferta_id, demanda_id);
CREATE INDEX matches_puntaje_idx ON matches (puntaje);

-- Índices para filtros comunes
CREATE INDEX ofertas_provincia_idx ON ofertas (provincia);
CREATE INDEX demandas_provincia_idx ON demandas (provincia);
CREATE INDEX ofertas_razas_idx ON ofertas (raza);
CREATE INDEX demandas_razas_idx ON demandas (raza);

-- Índices para RLS y validaciones
CREATE INDEX profiles_rol_idx ON profiles (rol);
CREATE INDEX profiles_email_aceptado_idx ON profiles (email_aceptado);

-- Índices para ofertas_media ordenamiento
CREATE INDEX oferta_media_oferta_orden_idx ON oferta_media (oferta_id, orden);

-- ============================================================
-- Políticas RLS (Row Level Security)
-- ============================================================

-- Helper: verificar que el usuario tiene email confirmado
-- Usamos: auth.jwt()->>'email_confirmed_at' IS NOT NULL
-- Esto se aplica en todas las tablas para evitar que usuarios sin verificar lean/escriban

-- ===== profiles =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfiles_select_confirmed" ON profiles
  FOR SELECT USING (auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLICY "perfiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "perfiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id AND auth.jwt()->>'email_confirmed_at' IS NOT NULL);

-- ===== ofertas =====
ALTER TABLE ofertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ofertas_select_confirmed" ON ofertas
  FOR SELECT USING (auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLICY "ofertas_insert_producer" ON ofertas
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    producer_id = auth.uid() -- verified via trigger or app logic
  );

CREATE POLICY "ofertas_update_producer" ON ofertas
  FOR UPDATE USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    producer_id = auth.uid()
  );

-- ===== demandas =====
ALTER TABLE demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demandas_select_confirmed" ON demandas
  FOR SELECT USING (auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLICY "demandas_insert_buyer" ON demandas
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    buyer_id = auth.uid()
  );

-- ===== matches =====
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLIC "matches_select_parties" ON matches
  FOR SELECT USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    (oferta_id IN (
      SELECT id FROM ofertas WHERE productor_id = auth.uid()
    ) OR demanda_id IN (
      SELECT id FROM demandas WHERE comprador_id = auth.uid()
    ))
  );

CREATE POLIC "matches_insert" ON matches
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL
  );

-- ===== fleteros =====
ALTER TABLE fleteros ENABLE ROW LEVEL SECURITY;

CREATE POLIC "fleteros_select_confirmed" ON fleteros
  FOR SELECT USING (auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLIC "fleteros_insert_own" ON fleteros
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.jwt()->>'email_confirmed_at' IS NOT NULL);

-- ===== vehiculos =====
ALTER TABLE vehiculos ENABLE ROW LEVEL SECURITY;

CREATE POLIC "vehiculos_select_owner" ON vehiculos
  FOR SELECT USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    fletero_id IN (SELECT user_id FROM fleteros WHERE user_id = auth.uid())
  );

CREATE POLIC "vehiculos_insert_own" ON vehiculos
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    fletero_id = auth.uid()
  );

-- ===== solicitudes_flete =====
ALTER TABLE solicitudes_flete ENABLE ROW LEVEL SECURITY;

CREATE POLIC "solicitudes_flete_select" ON solicitudes_flete
  FOR SELECT USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    (
      solicitante_id = auth.uid() OR
      fletero_id IN (SELECT user_id FROM fleteros WHERE user_id = auth.uid())
    )
  );

CREATE POLIC "solicitudes_flete_insert" ON solicitudes_flete
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    solicitante_id = auth.uid()
  );

-- ===== ofertas_flete =====
ALTER TABLE ofertas_flete ENABLE ROW LEVEL SECURITY;

CREATE POLIC "ofertas_flete_select" ON ofertas_flete
  FOR SELECT USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    fletero_id IN (SELECT user_id FROM fleteros WHERE user_id = auth.uid())
  );

CREATE POLIC "ofertas_flete_insert" ON ofertas_flete
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    fletero_id = auth.uid()
  );

-- ===== push_tokens =====
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLIC "push_tokens_select_own" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id AND auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLIC "push_tokens_insert_own" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.jwt()->>'email_confirmed_at' IS NOT NULL);

-- ===== notificaciones =====
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLIC "notificaciones_select_own" ON notificaciones
  FOR SELECT USING (auth.uid() = usuario_id AND auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLIC "notificaciones_insert_system" ON notificaciones
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    (auth.uid() = usuario_id OR current_setting('role') = 'service_role')
  );

-- ===== reportes =====
ALTER TABLE reportes ENABLE ROW LEVEL SECURITY;

CREATE POLIC "reportes_select_own" ON reportes
  FOR SELECT USING (auth.uid() = reportante_id AND auth.jwt()->>'email_confirmed_at' IS NOT NULL);

CREATE POLIC "reportes_insert_own" ON reportes
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    auth.uid() = reportante_id
  );

-- ===== conversaciones =====
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLIC "conversaciones_select_participants" ON conversaciones
  FOR SELECT USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    (participante_1 = auth.uid() OR participante_2 = auth.uid())
  );

-- ===== mensajes =====
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLIC "mensajes_select_conversation" ON mensajes
  FOR SELECT USING (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    conversacion_id IN (
      SELECT id FROM conversaciones WHERE participante_1 = auth.uid() OR participante_2 = auth.uid()
    )
  );

CREATE POLIC "mensajes_insert_own" ON mensajes
  FOR INSERT WITH CHECK (
    auth.jwt()->>'email_confirmed_at' IS NOT NULL AND
    conversacion_id IN (
      SELECT id FROM conversaciones WHERE participante_1 = auth.uid() OR participante_2 = auth.uid()
    )
  );

-- ============================================================
-- Triggers: actualizar updated_at en tablas
-- ============================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ofertas_updated_at BEFORE UPDATE ON ofertas FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER demandas_updated_at BEFORE UPDATE ON demandas FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER fleteros_updated_at BEFORE UPDATE ON fleteros FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER reportes_updated_at BEFORE UPDATE ON reportes FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- View: matching básico (ejemplo de consulta PostGIS ST_DWithin)
-- ============================================================

CREATE OR REPLACE VIEW view_matching_candidatos AS
SELECT
  o.id AS oferta_id,
  o.producer_id,
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
  -- Calcular distancia en km entre oferta y demanda ubicación
  ST_Distance(
    o.ubicacion::geography,
    d.ubicacion::geography
  ) / 1000 AS distancia_km,
  -- Puntaje base: categoría y raza coinciden + distancia dentro radio
  (
    CASE WHEN o.categoria = d.categoria THEN 30 ELSE 0 END +
    CASE WHEN o.raza = d.raza THEN 20 ELSE 0 END +
    CASE WHEN ST_DWithin(o.ubicacion::geography, d.ubicacion::geography, d.radio_km * 1000) THEN 30 ELSE 0 END +
    CASE WHEN ABS(o.peso_promedio::numeric - (d.peso_min_kg + d.peso_max_kg) / 2::numeric) <= 50 THEN 15 ELSE 0 END +
    CASE WHEN ABS(o.precio::numeric - d.precio_max::numeric) <= 100 THEN 5 ELSE 0 END
  ) AS puntaje_base
FROM ofertas o
JOIN demandas d ON d.estado = 'activa' AND o.estado = 'activa'
WHERE ST_DWithin(o.ubicacion::geography, d.ubicacion::geography, d.radio_km * 1000)
  AND o.categoria = d.categoria;

-- ============================================================
-- Comentarios finales
-- ============================================================

COMMENT ON TABLE profiles IS 'Perfil del usuario linked a auth.users, con rol y estado de email confirmado';
COMMENT ON TABLE ofertas IS 'Publicaciones de lotes de hacienda por productores';
COMMENT ON TABLE demandas IS 'Demandas de compradores con radio de búsqueda';
COMMENT ON TABLE matches IS 'Matching automático entre ofertas y demandas';
COMMENT ON TABLE ofertas_flete IS 'Ofertas de flete por parte de fleteros';
COMMENT ON POLICY "perfiles_select_confirmed" ON profiles IS 'Solo usuarios con email confirmado pueden leer perfiles';
-- Fin schema.sql