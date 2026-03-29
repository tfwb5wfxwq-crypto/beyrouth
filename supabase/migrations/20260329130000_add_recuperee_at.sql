-- Migration: Ajouter colonne recuperee_at pour tracker l'heure exacte de récupération
-- Date: 2026-03-29 13:00:00

-- Ajouter la colonne recuperee_at (nullable pour compatibilité anciennes commandes)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS recuperee_at TIMESTAMPTZ;

-- Créer un index pour optimiser les requêtes par date de récupération
CREATE INDEX IF NOT EXISTS idx_orders_recuperee_at ON orders(recuperee_at) WHERE recuperee_at IS NOT NULL;

-- Commentaire pour documentation
COMMENT ON COLUMN orders.recuperee_at IS 'Date et heure exacte où la commande a été marquée comme récupérée (picked up)';
