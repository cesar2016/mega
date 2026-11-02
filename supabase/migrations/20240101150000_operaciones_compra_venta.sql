-- Migración: crear tabla operaciones y agregar comprador_id a ofertas
ALTER TABLE public.ofertas
  ADD COLUMN IF NOT EXISTS comprador_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_venta TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.operaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id UUID NOT NULL REFERENCES public.ofertas(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comprador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  precio DECIMAL(12,2) NOT NULL,
  tipo_precio tipo_precio NOT NULL,
  cantidad INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  raza TEXT,
  localidad TEXT,
  provincia TEXT,
  comprador_nombre TEXT,
  comprador_telefono TEXT,
  comprador_email TEXT,
  vendedor_nombre TEXT,
  vendedor_telefono TEXT,
  vendedor_email TEXT,
  vendedor_establecimiento TEXT,
  estado TEXT DEFAULT 'confirmada',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.operaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'operaciones' AND policyname = 'operaciones_select_policy'
  ) THEN
    CREATE POLICY "operaciones_select_policy"
      ON public.operaciones FOR SELECT
      TO authenticated
      USING (vendedor_id = auth.uid() OR comprador_id = auth.uid());
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'operaciones' AND policyname = 'operaciones_insert_policy'
  ) THEN
    CREATE POLICY "operaciones_insert_policy"
      ON public.operaciones FOR INSERT
      TO authenticated
      WITH CHECK (comprador_id = auth.uid() OR vendedor_id = auth.uid());
  END IF;
END $$;
