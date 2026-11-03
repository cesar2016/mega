-- Migration: Cambiar correo de VendedorTest-10 a mganadero.ok@gmail.com y volver a cero todas las compras/ventas

DO $$
DECLARE
  v_vendedor_id UUID := '5446e68a-1482-452d-9bfe-e0bd3eb7d361';
  v_nuevo_email TEXT := 'mganadero.ok@gmail.com';
BEGIN
  -- Buscar por nombre si el ID variara
  SELECT id INTO v_vendedor_id
  FROM public.profiles
  WHERE id = '5446e68a-1482-452d-9bfe-e0bd3eb7d361'
     OR LOWER(TRIM(nombre)) = 'vendedortest-10'
  LIMIT 1;

  IF v_vendedor_id IS NOT NULL THEN
    -- Si otro usuario tenía ese email en auth.users, liberar el email único primero
    UPDATE auth.users
    SET email = 'old_' || id::text || '_mganadero.ok@gmail.com',
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', 'old_' || id::text || '_mganadero.ok@gmail.com')
    WHERE LOWER(email) = LOWER(v_nuevo_email)
      AND id <> v_vendedor_id;

    UPDATE auth.identities
    SET identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', 'old_' || user_id::text || '_mganadero.ok@gmail.com')
    WHERE provider = 'email'
      AND LOWER(identity_data->>'email') = LOWER(v_nuevo_email)
      AND user_id <> v_vendedor_id;

    -- Actualizar el correo de VendedorTest-10 en auth.users y auth.identities
    UPDATE auth.users
    SET email = v_nuevo_email,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', v_nuevo_email),
        updated_at = now()
    WHERE id = v_vendedor_id;

    UPDATE auth.identities
    SET identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_nuevo_email),
        updated_at = now()
    WHERE user_id = v_vendedor_id
      AND provider = 'email';

    UPDATE public.profiles
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_vendedor_id;
  END IF;
END $$;

-- 2. Volver a cero todas las compras y ventas y reactivar todos los lotes como disponibles
ALTER TABLE public.ofertas DISABLE TRIGGER bloquear_edicion_oferta_vendida;

DELETE FROM public.operaciones;

UPDATE public.ofertas
SET estado = 'activa',
    comprador_id = NULL,
    fecha_venta = NULL,
    vigencia = GREATEST(vigencia, now() + interval '30 days'),
    updated_at = now()
WHERE estado IN ('vendida', 'completada')
   OR comprador_id IS NOT NULL
   OR fecha_venta IS NOT NULL;

ALTER TABLE public.ofertas ENABLE TRIGGER bloquear_edicion_oferta_vendida;
