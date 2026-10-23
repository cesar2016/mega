-- Migration: proteger datos sensibles de los usuarios entre sí
--
-- Los datos fiscales/personales en `productores` (CUIT, RENSPA, establecimiento)
-- y en `fleteros` sólo pueden ser leídos por el propio titular de la cuenta.

DROP POLICY IF EXISTS "productores_select_confirmed" ON public.productores;
DROP POLICY IF EXISTS "productores_select_own" ON public.productores;
CREATE POLICY "productores_select_own" ON public.productores
  FOR SELECT USING (auth.uid() = user_id AND public.email_confirmado());

DROP POLICY IF EXISTS "fleteros_select_confirmed" ON public.fleteros;
DROP POLICY IF EXISTS "fleteros_select_own" ON public.fleteros;
CREATE POLICY "fleteros_select_own" ON public.fleteros
  FOR SELECT USING (auth.uid() = user_id AND public.email_confirmado());
