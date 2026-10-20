-- Migration: corregir el check de "email confirmado" en las políticas RLS
--
-- El schema original usaba auth.jwt()->>'email_confirmed_at' IS NOT NULL.
-- Con las claves nuevas de Supabase el JWT ya no incluye ese claim, así que
-- TODAS las políticas quedaban en false y la app no podía leer ni escribir
-- nada. Se reemplazan por public.email_confirmado(), que lee
-- auth.users.email_confirmed_at con SECURITY DEFINER (dato no falseable).

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

-- Reescribe la expresión de cada política que use el claim viejo.
-- Postgres normaliza la expresión así:
--   ((auth.jwt() ->> 'email_confirmed_at'::text) IS NOT NULL)
DO $$
DECLARE
  r RECORD;
  v_using TEXT;
  v_check TEXT;
  v_patron CONSTANT TEXT :=
    $re$\(auth\.jwt\(\) ->> 'email_confirmed_at'(::text)?\) IS NOT NULL$re$;
BEGIN
  FOR r IN
    SELECT
      c.relname AS tabla,
      p.polname AS politica,
      p.polcmd AS cmd,
      pg_get_expr(p.polqual, p.polrelid) AS using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expr
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    v_using := CASE
      WHEN r.using_expr IS NULL THEN NULL
      ELSE regexp_replace(r.using_expr, v_patron, 'public.email_confirmado()', 'g')
    END;

    v_check := CASE
      WHEN r.check_expr IS NULL THEN NULL
      ELSE regexp_replace(r.check_expr, v_patron, 'public.email_confirmado()', 'g')
    END;

    IF v_using IS DISTINCT FROM r.using_expr OR v_check IS DISTINCT FROM r.check_expr THEN
      -- INSERT sólo admite WITH CHECK; SELECT/DELETE sólo USING.
      IF r.cmd <> 'i' AND v_using IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I USING (%s)',
          r.politica, r.tabla, v_using
        );
      END IF;

      IF r.cmd <> 's' AND r.cmd <> 'd' AND v_check IS NOT NULL THEN
        EXECUTE format(
          'ALTER POLICY %I ON public.%I WITH CHECK (%s)',
          r.politica, r.tabla, v_check
        );
      END IF;

      RAISE NOTICE 'Política actualizada: % (%) sobre %', r.politica, r.cmd, r.tabla;
    END IF;
  END LOOP;
END$$;

-- Fin migration rls_email_confirmado
