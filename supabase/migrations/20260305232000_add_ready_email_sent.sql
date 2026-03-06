-- Migration: Ajouter tracking email "commande prête"
-- Permet de savoir si l'email a déjà été envoyé pour éviter les doublons

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_email_sent_at TIMESTAMP WITH TIME ZONE;

-- Index pour filtrer les commandes prêtes sans email envoyé
CREATE INDEX IF NOT EXISTS idx_orders_ready_no_email ON orders(statut, ready_email_sent_at)
WHERE statut = 'prete' AND ready_email_sent_at IS NULL;
