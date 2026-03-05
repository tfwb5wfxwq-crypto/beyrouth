-- Migration: Ajouter want_receipt dans orders
-- Permet de savoir si le client veut recevoir son reçu par email

-- Ajouter colonne want_receipt dans orders (défaut: true)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS want_receipt BOOLEAN DEFAULT true;

-- Vérifier que optin_promo existe dans clients (normalement déjà créé)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS optin_promo BOOLEAN DEFAULT false;

-- Ajouter index pour filtrer clients qui veulent recevoir des promos
CREATE INDEX IF NOT EXISTS idx_clients_optin_promo ON clients(optin_promo) WHERE optin_promo = true;
