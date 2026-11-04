-- Función SECURITY DEFINER para registrar o reasignar una suscripción Web Push al usuario actual
-- en el mismo dispositivo sin que RLS bloquee el ON CONFLICT (endpoint) al cambiar de cuenta.
CREATE OR REPLACE FUNCTION public.registrar_push_subscription(
  p_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES (p_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent, now())
  ON CONFLICT (endpoint)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    user_agent = COALESCE(EXCLUDED.user_agent, public.push_subscriptions.user_agent),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_push_subscription(uuid, text, text, text, text) TO anon, authenticated, service_role;
