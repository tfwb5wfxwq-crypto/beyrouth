-- Migration: Supprimer l'ancienne version UUID de assign_invoice_to_order
-- Pour éviter l'ambiguïté entre les deux signatures

DROP FUNCTION IF EXISTS assign_invoice_to_order(UUID, TEXT, TEXT, TEXT);
