-- Migration: Mise à jour du tracking des emails
-- Remplacer ready_email_sent_at par confirmation_email_sent_at
-- Supprimer want_receipt (obsolète, toujours inclus)

-- Supprimer ready_email_sent_at et son index
DROP INDEX IF EXISTS idx_orders_ready_no_email;
ALTER TABLE orders DROP COLUMN IF EXISTS ready_email_sent_at;

-- Ajouter confirmation_email_sent_at
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMP WITH TIME ZONE;

-- Index pour filtrer les commandes acceptées sans email envoyé
CREATE INDEX IF NOT EXISTS idx_orders_confirmation_no_email ON orders(statut, confirmation_email_sent_at)
WHERE statut = 'acceptee' AND confirmation_email_sent_at IS NULL;

-- Supprimer want_receipt (obsolète)
ALTER TABLE orders DROP COLUMN IF EXISTS want_receipt;
