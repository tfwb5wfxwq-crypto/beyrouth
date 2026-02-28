-- Migration: Ajouter colonne 'note' à la table orders
-- Date: 2026-02-28
-- À exécuter dans: https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/sql/new

-- Ajouter la colonne note pour les remarques clients
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS note TEXT;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN orders.note IS 'Note ou remarque du client pour la commande';

-- Vérifier que la colonne a été ajoutée
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
