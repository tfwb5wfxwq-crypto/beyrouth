-- Ajouter colonne pour tracker l'envoi des emails de relance
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- Commentaire
COMMENT ON COLUMN orders.reminder_sent_at IS 'Timestamp du dernier email de relance envoyé au client';
