-- Extend provider_type enum with Bigdirekt and Viactiv
ALTER TYPE public.provider_type ADD VALUE IF NOT EXISTS 'Bigdirekt';
ALTER TYPE public.provider_type ADD VALUE IF NOT EXISTS 'Viactiv';

-- Add optional OpenWA metadata columns to raw_messages
ALTER TABLE public.raw_messages ADD COLUMN IF NOT EXISTS chat_id TEXT;
ALTER TABLE public.raw_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';
ALTER TABLE public.raw_messages ADD COLUMN IF NOT EXISTS pdf_filename TEXT;

-- Create vb_settlement_settings table for storing Übersicht adjustments per VB (Vor Monat, Vorschuss, MwSt)
CREATE TABLE IF NOT EXISTS public.vb_settlement_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vb_name TEXT NOT NULL UNIQUE,
  vor_monat_amount NUMERIC(10,2) DEFAULT 0,
  vor_monat_label TEXT DEFAULT 'TDO-Academy',
  vorschuss_amount NUMERIC(10,2) DEFAULT 0,
  vorschuss_label TEXT DEFAULT 'Vorschuss',
  ohne_mwst_1 NUMERIC(10,2) DEFAULT 0,
  mit_mwst_1 NUMERIC(10,2) DEFAULT 0,
  ohne_mwst_2 NUMERIC(10,2) DEFAULT 0,
  mit_mwst_2 NUMERIC(10,2) DEFAULT 0,
  extra_col_2 NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vb_settlement_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vb_settlement_settings' AND policyname = 'Authenticated can view vb_settlement_settings'
  ) THEN
    CREATE POLICY "Authenticated can view vb_settlement_settings" ON public.vb_settlement_settings
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vb_settlement_settings' AND policyname = 'Authenticated can upsert vb_settlement_settings'
  ) THEN
    CREATE POLICY "Authenticated can upsert vb_settlement_settings" ON public.vb_settlement_settings
      FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;
