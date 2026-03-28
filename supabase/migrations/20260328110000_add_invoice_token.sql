-- Migration: Ajouter token sécurisé pour les factures

-- Ajouter la colonne invoice_token
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_token UUID;

-- Créer un index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_orders_invoice_token ON orders(invoice_token);

-- Générer des tokens pour les commandes existantes
UPDATE orders
SET invoice_token = gen_random_uuid()
WHERE invoice_token IS NULL;

-- Rendre la colonne obligatoire pour les nouvelles commandes
ALTER TABLE orders ALTER COLUMN invoice_token SET DEFAULT gen_random_uuid();
ALTER TABLE orders ALTER COLUMN invoice_token SET NOT NULL;

-- Ajouter une contrainte d'unicité
ALTER TABLE orders ADD CONSTRAINT orders_invoice_token_unique UNIQUE (invoice_token);
