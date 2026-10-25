-- Migration: estado de lectura en mensajes y RPC para marcar como leídos
--
-- 1. Agrega columna `leido_en` a `public.mensajes` e índice parcial para contar
--    rápidamente los mensajes sin leer por conversación.
-- 2. Permite que el destinatario de los mensajes dentro de una conversación
--    marque los mensajes entrantes como leídos (RLS + RPC `marcar_mensajes_leidos`).

ALTER TABLE public.mensajes
  ADD COLUMN IF NOT EXISTS leido_en TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS mensajes_no_leidos_idx
  ON public.mensajes (conversacion_id, remitente_id)
  WHERE leido_en IS NULL;

DROP POLICY IF EXISTS "mensajes_update_recipient" ON public.mensajes;
CREATE POLICY "mensajes_update_recipient" ON public.mensajes
  FOR UPDATE USING (
    public.email_confirmado() AND
    remitente_id <> auth.uid() AND
    conversacion_id IN (
      SELECT id FROM public.conversaciones
      WHERE participante_1 = auth.uid() OR participante_2 = auth.uid()
    )
  )
  WITH CHECK (
    public.email_confirmado() AND
    remitente_id <> auth.uid() AND
    conversacion_id IN (
      SELECT id FROM public.conversaciones
      WHERE participante_1 = auth.uid() OR participante_2 = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.marcar_mensajes_leidos(p_conversacion_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mi_id UUID := auth.uid();
  v_actualizados INT := 0;
BEGIN
  IF v_mi_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.mensajes m
  SET leido_en = now()
  FROM public.conversaciones c
  WHERE m.conversacion_id = p_conversacion_id
    AND c.id = m.conversacion_id
    AND (c.participante_1 = v_mi_id OR c.participante_2 = v_mi_id)
    AND m.remitente_id <> v_mi_id
    AND m.leido_en IS NULL;

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  RETURN v_actualizados;
END;
$$;
