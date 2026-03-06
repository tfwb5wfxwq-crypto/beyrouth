-- Migration: Système de facturation conforme
-- Ajoute les colonnes nécessaires pour générer des factures officielles avec numérotation séquentielle

-- Ajouter colonnes pour les factures dans la table orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS invoice_number TEXT NULL UNIQUE,
ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS invoice_siret TEXT NULL,
ADD COLUMN IF NOT EXISTS invoice_company TEXT NULL,
ADD COLUMN IF NOT EXISTS invoice_address TEXT NULL;

-- Index pour recherche rapide par numéro de facture
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number) WHERE invoice_number IS NOT NULL;

-- Index pour tri par date de génération
CREATE INDEX IF NOT EXISTS idx_orders_invoice_generated_at ON orders(invoice_generated_at) WHERE invoice_generated_at IS NOT NULL;

-- Fonction pour générer le prochain numéro de facture séquentiel
-- Format: YYYY-NNNN (ex: 2026-0001, 2026-0002...)
CREATE OR REPLACE FUNCTION generate_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year INT;
  last_number INT;
  next_number INT;
  invoice_num TEXT;
BEGIN
  -- Année en cours
  current_year := EXTRACT(YEAR FROM NOW());

  -- Trouver le dernier numéro de facture de l'année en cours
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(invoice_number FROM '\d+$') AS INT
      )
    ),
    0
  ) INTO last_number
  FROM orders
  WHERE invoice_number LIKE current_year || '-%';

  -- Incrémenter
  next_number := last_number + 1;

  -- Formater avec zéros (ex: 0001)
  invoice_num := current_year || '-' || LPAD(next_number::TEXT, 4, '0');

  RETURN invoice_num;
END;
$$;

-- Fonction pour attribuer un numéro de facture à une commande
-- Cette fonction est transactionnelle et thread-safe (évite les doublons)
CREATE OR REPLACE FUNCTION assign_invoice_to_order(
  p_order_id UUID,
  p_siret TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL
)
RETURNS TABLE(invoice_number TEXT, order_data JSON)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_number TEXT;
  v_order_data JSON;
  v_existing_invoice TEXT;
BEGIN
  -- Vérifier si la commande a déjà une facture
  SELECT orders.invoice_number INTO v_existing_invoice
  FROM orders
  WHERE id = p_order_id;

  IF v_existing_invoice IS NOT NULL THEN
    -- Facture déjà générée, retourner l'existante
    SELECT
      orders.invoice_number,
      row_to_json(orders.*)
    INTO v_invoice_number, v_order_data
    FROM orders
    WHERE id = p_order_id;

    RETURN QUERY SELECT v_invoice_number, v_order_data;
    RETURN;
  END IF;

  -- Générer nouveau numéro (thread-safe avec SELECT FOR UPDATE)
  LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE;
  v_invoice_number := generate_next_invoice_number();

  -- Attribuer le numéro à la commande
  UPDATE orders
  SET
    invoice_number = v_invoice_number,
    invoice_generated_at = NOW(),
    invoice_siret = p_siret,
    invoice_company = p_company,
    invoice_address = p_address
  WHERE id = p_order_id
  RETURNING row_to_json(orders.*) INTO v_order_data;

  RETURN QUERY SELECT v_invoice_number, v_order_data;
END;
$$;

-- Commentaires pour documentation
COMMENT ON COLUMN orders.invoice_number IS 'Numéro de facture séquentiel (format: YYYY-NNNN). NULL si aucune facture générée.';
COMMENT ON COLUMN orders.invoice_generated_at IS 'Date et heure de génération de la facture';
COMMENT ON COLUMN orders.invoice_siret IS 'SIRET du client (si professionnel)';
COMMENT ON COLUMN orders.invoice_company IS 'Nom de la société (si professionnel)';
COMMENT ON COLUMN orders.invoice_address IS 'Adresse de facturation (si professionnel)';
COMMENT ON FUNCTION generate_next_invoice_number() IS 'Génère le prochain numéro de facture séquentiel pour l''année en cours';
COMMENT ON FUNCTION assign_invoice_to_order IS 'Attribue un numéro de facture unique à une commande (thread-safe, idempotent)';
