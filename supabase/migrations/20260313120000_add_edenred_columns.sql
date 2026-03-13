-- Ajouter les colonnes Edenred à la table orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS edenred_payment_id TEXT,
ADD COLUMN IF NOT EXISTS edenred_status TEXT;

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_orders_edenred_payment_id ON orders(edenred_payment_id);
