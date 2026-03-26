-- Ajouter colonnes pour tracking email Brevo
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_orders_email_status ON orders(email_status);

COMMENT ON COLUMN orders.email_status IS 'Statut email Brevo: pending, sent, delivered, opened, error';
COMMENT ON COLUMN orders.email_delivered_at IS 'Timestamp livraison email (event delivered de Brevo)';
COMMENT ON COLUMN orders.email_opened_at IS 'Timestamp ouverture email (event opened/proxy_open de Brevo)';
COMMENT ON COLUMN orders.email_error IS 'Message erreur si email_status = error';
