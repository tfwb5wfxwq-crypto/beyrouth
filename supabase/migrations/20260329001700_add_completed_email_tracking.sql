-- Ajouter colonne pour tracker l'email de remerciement après récupération

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS completed_email_sent_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN orders.completed_email_sent_at IS 'Date d''envoi de l''email de remerciement (après récupération)';
