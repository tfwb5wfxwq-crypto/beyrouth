-- Migration: Supprimer le système code_retrait
-- Le numéro de commande (4 chiffres + 2 lettres) fait office de code

-- Supprimer le trigger
DROP TRIGGER IF EXISTS trigger_set_code_retrait ON orders;

-- Supprimer la fonction
DROP FUNCTION IF EXISTS set_code_retrait();
DROP FUNCTION IF EXISTS generate_code_retrait();

-- Supprimer l'index
DROP INDEX IF EXISTS idx_orders_code_retrait;

-- Supprimer la colonne
ALTER TABLE orders DROP COLUMN IF EXISTS code_retrait;
