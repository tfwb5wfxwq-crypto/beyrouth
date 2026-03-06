-- Migration: Ajouter tracking pour remboursements PayGreen
-- Date: 6 mars 2026

-- Ajouter colonnes pour tracker les remboursements
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount INTEGER; -- en centimes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_error TEXT;

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_orders_refund_transaction_id ON orders(refund_transaction_id);

-- Commentaires
COMMENT ON COLUMN orders.refund_transaction_id IS 'ID de transaction remboursement PayGreen';
COMMENT ON COLUMN orders.refund_requested_at IS 'Date/heure demande remboursement';
COMMENT ON COLUMN orders.refund_completed_at IS 'Date/heure remboursement confirmé';
COMMENT ON COLUMN orders.refund_amount IS 'Montant remboursé en centimes';
COMMENT ON COLUMN orders.refund_error IS 'Message erreur si remboursement échoué';
