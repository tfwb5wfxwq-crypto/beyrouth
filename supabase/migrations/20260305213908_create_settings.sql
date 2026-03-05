-- Créer table settings
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer settings par défaut
INSERT INTO public.settings (key, value) VALUES
  ('click_collect_enabled', 'true'),
  ('auto_accept_orders', 'false'),
  ('admin_code', 'A5qYIeJatg')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: tout le monde peut lire
DROP POLICY IF EXISTS "Allow public read" ON public.settings;
CREATE POLICY "Allow public read" ON public.settings
  FOR SELECT USING (true);

-- Policy: authenticated peut modifier
DROP POLICY IF EXISTS "Allow authenticated update" ON public.settings;
CREATE POLICY "Allow authenticated update" ON public.settings
  FOR ALL USING (true);
