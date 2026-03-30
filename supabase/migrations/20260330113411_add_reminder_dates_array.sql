-- Migration: Stocker toutes les dates de relances
-- Date: 2026-03-30

-- Ajouter colonne reminder_dates (array JSON)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_dates JSONB DEFAULT '[]'::jsonb;

-- Migrer les commandes existantes avec reminder_sent_at
UPDATE orders 
SET reminder_dates = jsonb_build_array(reminder_sent_at::text)
WHERE reminder_sent_at IS NOT NULL AND reminder_dates = '[]'::jsonb;

-- Commentaire
COMMENT ON COLUMN orders.reminder_dates IS 'Array de toutes les dates où le client a été relancé (format ISO 8601)';
