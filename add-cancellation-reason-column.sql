-- Ajouter colonne cancellation_reason à la table orders
-- À exécuter dans Supabase SQL Editor

-- Vérifier si la colonne existe déjà, sinon l'ajouter
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'cancellation_reason'
    ) THEN
        ALTER TABLE orders ADD COLUMN cancellation_reason TEXT;
        RAISE NOTICE 'Colonne cancellation_reason ajoutée';
    ELSE
        RAISE NOTICE 'Colonne cancellation_reason existe déjà';
    END IF;
END $$;
