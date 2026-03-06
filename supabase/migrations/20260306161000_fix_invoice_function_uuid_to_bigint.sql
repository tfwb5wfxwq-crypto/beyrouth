-- Migration: Corriger assign_invoice_to_order pour accepter BIGINT au lieu de UUID
-- La table orders utilise BIGSERIAL (BIGINT) pour l'id, pas UUID

CREATE OR REPLACE FUNCTION assign_invoice_to_order(
  p_order_id BIGINT,
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
