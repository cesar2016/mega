-- Migration: sincronizar profiles.email_confirmed_at con auth.users
--
-- El onboarding de la app chequea profiles.email_confirmed_at para decidir si
-- el usuario ya pasó el flujo. Auth sólo lo guarda en auth.users, así que
-- hace falta un trigger que lo copie.

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

-- Actualiza también los perfiles ya existentes que were confirmados antes de
-- este trigger.
UPDATE public.profiles p
SET email_confirmed_at = u.email_confirmed_at,
    updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_confirmed_at IS NULL;

-- Fin migration sync_email_confirmed
