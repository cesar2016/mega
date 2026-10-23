-- Migration: chat interno seguro con bloqueo de datos de contacto
--
-- 1. Agrega FKs opcionales en `conversaciones` hacia `ofertas` y `demandas` para
--    poder embeber el contexto de la negociación.
-- 2. Completa las políticas RLS de `conversaciones` y provee el RPC
--    `iniciar_o_abrir_conversacion` para crear o reutilizar un hilo entre partes.
-- 3. Agrega un trigger `BEFORE INSERT OR UPDATE` en `mensajes` (y en
--    `ofertas.descripcion`) que bloquea a nivel base de datos cualquier intento
--    de compartir teléfonos, emails, redes sociales, enlaces o números en letras.
-- 4. Actualiza `ultimo_mensaje_en` automáticamente al insertar un mensaje y
--    habilita Realtime sobre `conversaciones` y `mensajes`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversaciones_oferta_id_fkey'
  ) THEN
    ALTER TABLE public.conversaciones
      ADD CONSTRAINT conversaciones_oferta_id_fkey
      FOREIGN KEY (oferta_id) REFERENCES public.ofertas(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversaciones_demanda_id_fkey'
  ) THEN
    ALTER TABLE public.conversaciones
      ADD CONSTRAINT conversaciones_demanda_id_fkey
      FOREIGN KEY (demanda_id) REFERENCES public.demandas(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Políticas RLS de conversaciones
DROP POLICY IF EXISTS "conversaciones_select_participants" ON public.conversaciones;
CREATE POLICY "conversaciones_select_participants" ON public.conversaciones
  FOR SELECT USING (
    public.email_confirmado() AND
    (participante_1 = auth.uid() OR participante_2 = auth.uid())
  );

DROP POLICY IF EXISTS "conversaciones_insert_participants" ON public.conversaciones;
CREATE POLICY "conversaciones_insert_participants" ON public.conversaciones
  FOR INSERT WITH CHECK (
    public.email_confirmado() AND
    (participante_1 = auth.uid() OR participante_2 = auth.uid()) AND
    participante_1 <> participante_2
  );

DROP POLICY IF EXISTS "conversaciones_update_participants" ON public.conversaciones;
CREATE POLICY "conversaciones_update_participants" ON public.conversaciones
  FOR UPDATE USING (
    public.email_confirmado() AND
    (participante_1 = auth.uid() OR participante_2 = auth.uid())
  );

-- Función detectora de datos de contacto a nivel SQL
CREATE OR REPLACE FUNCTION public.contiene_datos_contacto(p_texto TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_texto TEXT := trim(COALESCE(p_texto, ''));
  v_digitos TEXT;
  v_palabras_num INT;
BEGIN
  IF v_texto = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Correos electrónicos o menciones de arroba / proveedores de mail
  IF v_texto ~* '[a-z0-9._%+-]+\s*(@|\marroba\M|\(at\)|\[at\])\s*[a-z0-9.-]+'
     OR v_texto ~* '\m(gmail|hotmail|outlook|yahoo|icloud|live\.com|protonmail)\M' THEN
    RETURN 'No está permitido compartir direcciones de correo electrónico.';
  END IF;

  -- 2. Enlaces web o dominios
  IF v_texto ~* '(https?://|www\.|[a-z0-9-]+\.(com|ar|net|org|io|me|app)\M)' THEN
    RETURN 'No está permitido incluir enlaces web o dominios externos.';
  END IF;

  -- 3. Redes sociales o mensajería externa
  IF v_texto ~* '\m(whatsapp|wasap|wsp|wpp|whapp|telegram|instagram|insta|facebook|messenger|tiktok|linkedin|twitter)\M'
     OR v_texto ~ '(^|\s)@[a-zA-Z0-9_.]{3,}' THEN
    RETURN 'No está permitido compartir WhatsApp ni usuarios de redes sociales.';
  END IF;

  -- 4. Frases de evasión o CUIT
  IF v_texto ~* '\m(llamame|llámame|escribime al|agendame|mi cel|mi celular|mi telefono|mi teléfono|mi numero|mi número)\M'
     OR v_texto ~ '\m(20|23|24|27|30|33)[-\s.]?[0-9]{8}[-\s.]?[0-9]\M' THEN
    RETURN 'Por seguridad, toda la comunicación debe mantenerse dentro del chat del sitio.';
  END IF;

  -- 5. Secuencias numéricas de 6 o más dígitos (aún separados por espacios, guiones o puntos)
  IF v_texto ~ '\+?[0-9]([0-9\s.\-()/,_]*[0-9]){5,}' THEN
    RETURN 'No está permitido enviar números de teléfono ni secuencias numéricas de contacto.';
  END IF;

  -- 6. Total de dígitos en el texto >= 8
  v_digitos := regexp_replace(v_texto, '[^0-9]', '', 'g');
  IF length(v_digitos) >= 8 THEN
    RETURN 'El mensaje contiene demasiados dígitos y fue bloqueado por seguridad.';
  END IF;

  -- 7. Números dictados en letras (4 o más palabras numéricas en el mismo mensaje)
  SELECT count(*)
  INTO v_palabras_num
  FROM regexp_matches(
    lower(v_texto),
    '\m(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|quince)\M',
    'g'
  );

  IF COALESCE(v_palabras_num, 0) >= 4 THEN
    RETURN 'No está permitido dictar números de teléfono en letras.';
  END IF;

  RETURN NULL;
END;
$$;

-- Trigger para bloquear datos de contacto en mensajes del chat
CREATE OR REPLACE FUNCTION public.trg_validar_mensaje_sin_contacto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_motivo TEXT;
BEGIN
  v_motivo := public.contiene_datos_contacto(NEW.cuerpo);
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION '%', v_motivo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_mensaje_sin_contacto ON public.mensajes;
CREATE TRIGGER validar_mensaje_sin_contacto
  BEFORE INSERT OR UPDATE OF cuerpo ON public.mensajes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validar_mensaje_sin_contacto();

-- Trigger para bloquear datos de contacto en la descripción de las ofertas
CREATE OR REPLACE FUNCTION public.trg_validar_oferta_sin_contacto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_motivo TEXT;
BEGIN
  v_motivo := public.contiene_datos_contacto(NEW.descripcion);
  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION '%', v_motivo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_oferta_sin_contacto ON public.ofertas;
CREATE TRIGGER validar_oferta_sin_contacto
  BEFORE INSERT OR UPDATE OF descripcion ON public.ofertas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_validar_oferta_sin_contacto();

-- Actualizar ultimo_mensaje_en en la conversación cada vez que entra un mensaje
CREATE OR REPLACE FUNCTION public.trg_actualizar_ultimo_mensaje_conversacion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversaciones
  SET ultimo_mensaje_en = COALESCE(NEW.creado_en, now())
  WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actualizar_ultimo_mensaje_conversacion ON public.mensajes;
CREATE TRIGGER actualizar_ultimo_mensaje_conversacion
  AFTER INSERT ON public.mensajes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_actualizar_ultimo_mensaje_conversacion();

-- RPC para iniciar o abrir una conversación entre dos usuarios
CREATE OR REPLACE FUNCTION public.iniciar_o_abrir_conversacion(
  p_contraparte_id UUID,
  p_oferta_id UUID DEFAULT NULL,
  p_demanda_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mi_id UUID := auth.uid();
  v_conv_id UUID;
  v_p1 UUID;
  v_p2 UUID;
BEGIN
  IF v_mi_id IS NULL OR NOT public.email_confirmado() THEN
    RAISE EXCEPTION 'Debés iniciar sesión con un correo confirmado para usar el chat.';
  END IF;

  IF p_contraparte_id IS NULL OR p_contraparte_id = v_mi_id THEN
    RAISE EXCEPTION 'No podés iniciar una conversación con tu propio usuario.';
  END IF;

  -- Orden canónico de participantes para evitar duplicados invertidos
  IF v_mi_id::text < p_contraparte_id::text THEN
    v_p1 := v_mi_id;
    v_p2 := p_contraparte_id;
  ELSE
    v_p1 := p_contraparte_id;
    v_p2 := v_mi_id;
  END IF;

  SELECT c.id
  INTO v_conv_id
  FROM public.conversaciones c
  WHERE ((c.participante_1 = v_mi_id AND c.participante_2 = p_contraparte_id)
      OR (c.participante_1 = p_contraparte_id AND c.participante_2 = v_mi_id))
    AND COALESCE(c.oferta_id, c.demanda_id) IS NOT DISTINCT FROM COALESCE(p_oferta_id, p_demanda_id)
  ORDER BY c.ultimo_mensaje_en DESC NULLS LAST
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.conversaciones (oferta_id, demanda_id, participante_1, participante_2)
  VALUES (p_oferta_id, p_demanda_id, v_p1, v_p2)
  RETURNING id INTO v_conv_id;

  RETURN v_conv_id;
END;
$$;

-- Habilitar Realtime para mensajes y conversaciones (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mensajes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversaciones'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversaciones;
    END IF;
  END IF;
END$$;
