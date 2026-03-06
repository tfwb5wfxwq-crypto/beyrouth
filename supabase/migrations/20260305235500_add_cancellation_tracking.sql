-- Migration: Ajouter tracking email d'annulation
-- Permet de savoir si l'email d'annulation a été envoyé

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_email_sent_at TIMESTAMP WITH TIME ZONE;

-- Index pour filtrer les commandes annulées sans email envoyé
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_no_email ON orders(statut, cancellation_email_sent_at)
WHERE statut = 'cancelled' AND cancellation_email_sent_at IS NULL;
