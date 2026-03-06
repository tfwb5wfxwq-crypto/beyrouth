-- Migration: Ajouter tracking pour email immédiat après paiement
-- Date: 6 mars 2026

-- Ajouter colonne pour tracker l'email de confirmation de paiement
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_email_sent_at TIMESTAMP WITH TIME ZONE;

-- Index pour filtrer les commandes payées sans email envoyé
CREATE INDEX IF NOT EXISTS idx_orders_paid_no_email ON orders(statut, payment_email_sent_at)
WHERE statut = 'payee' AND payment_email_sent_at IS NULL;

-- Commentaire
COMMENT ON COLUMN orders.payment_email_sent_at IS 'Date/heure envoi email immédiat après paiement confirmé';
