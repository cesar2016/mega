-- Tabla de suscripciones Web Push (VAPID) para notificaciones en segundo plano con la app cerrada
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios gestionan sus propias suscripciones push" ON public.push_subscriptions;
CREATE POLICY "Usuarios gestionan sus propias suscripciones push"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Función SECURITY DEFINER para que el endpoint backend pueda consultar las suscripciones de un destinatario
CREATE OR REPLACE FUNCTION public.obtener_push_subscriptions_usuario(p_user_id uuid)
RETURNS TABLE (
  endpoint text,
  p256dh text,
  auth text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ps.endpoint, ps.p256dh, ps.auth
  FROM public.push_subscriptions ps
  WHERE ps.user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_push_subscriptions_usuario(uuid) TO anon, authenticated, service_role;

-- Función SECURITY DEFINER para eliminar un endpoint vencido (404 / 410 de Web Push)
CREATE OR REPLACE FUNCTION public.eliminar_push_subscription_endpoint(p_endpoint text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.eliminar_push_subscription_endpoint(text) TO anon, authenticated, service_role;
