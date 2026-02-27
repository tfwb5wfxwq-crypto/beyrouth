-- Migration: Ajouter colonnes Paygreen à la table orders

-- Ajouter les colonnes Paygreen
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paygreen_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paygreen_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- Modifier la contrainte statut pour inclure les statuts de paiement
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_statut_check;
ALTER TABLE orders ADD CONSTRAINT orders_statut_check
  CHECK (statut IN ('pending', 'payee', 'acceptee', 'en_preparation', 'prete', 'recuperee', 'cancelled', 'refunded'));

-- Modifier le statut par défaut
ALTER TABLE orders ALTER COLUMN statut SET DEFAULT 'pending';

-- Ajouter index pour performances
CREATE INDEX IF NOT EXISTS idx_orders_paygreen_transaction_id ON orders(paygreen_transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_paygreen_status ON orders(paygreen_status);

-- Mettre à jour les RLS pour permettre les webhooks
-- (Les webhooks Paygreen utilisent la service_role_key)

-- Commentaires
COMMENT ON COLUMN orders.paygreen_transaction_id IS 'ID de transaction Paygreen (ex: pi_xxx)';
COMMENT ON COLUMN orders.paygreen_status IS 'Statut Paygreen (SUCCESSED, CANCELLED, etc.)';
COMMENT ON COLUMN orders.payment_confirmed_at IS 'Date/heure de confirmation du paiement';
