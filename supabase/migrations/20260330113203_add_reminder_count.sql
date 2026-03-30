-- Migration: Ajouter compteur de relances
-- Date: 2026-03-30

-- Ajouter colonne reminder_count
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0;

-- Mettre à 1 pour les commandes déjà relancées (qui ont reminder_sent_at)
UPDATE orders SET reminder_count = 1 WHERE reminder_sent_at IS NOT NULL AND reminder_count = 0;

-- Commentaire
COMMENT ON COLUMN orders.reminder_count IS 'Nombre de fois que le client a été relancé par email';
