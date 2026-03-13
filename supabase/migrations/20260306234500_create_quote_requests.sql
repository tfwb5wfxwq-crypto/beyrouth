-- Migration: Créer table pour demandes de devis
-- Date: 6 mars 2026 23:45

-- Table quote_requests pour stocker les demandes de devis traiteur
CREATE TABLE IF NOT EXISTS quote_requests (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  event_type TEXT,
  guest_count INTEGER,
  event_date DATE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'accepted', 'rejected')),
  quote_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_quote_requests_email ON quote_requests(client_email);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at DESC);

-- RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Admin peut tout voir
CREATE POLICY "quote_requests_admin_all" ON quote_requests
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy: Clients peuvent insérer leurs demandes
CREATE POLICY "quote_requests_insert_anon" ON quote_requests
  FOR INSERT WITH CHECK (true);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_quote_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_requests_updated_at();

-- Commentaires
COMMENT ON TABLE quote_requests IS 'Demandes de devis pour événements et traiteur';
COMMENT ON COLUMN quote_requests.status IS 'pending, quoted, accepted, rejected';
