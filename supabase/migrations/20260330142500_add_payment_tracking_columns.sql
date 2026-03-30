-- Ajouter colonnes de tracking des paiements (payment_method, paygreen_payment_id, edenred_payment_id)
-- Ces colonnes permettent de différencier les moyens de paiement (PayGreen CB/Swile/Conecs vs Edenred)
-- et de stocker les IDs de transaction pour les remboursements

-- 1. Colonne payment_method : 'paygreen' ou 'edenred'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
COMMENT ON COLUMN orders.payment_method IS 'Moyen de paiement utilisé: "paygreen" (CB, Swile, Conecs...) ou "edenred" (Ticket Restaurant)';

-- 2. Colonne paygreen_payment_id : ID de paiement PayGreen (différent de transaction_id pour refunds)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paygreen_payment_id TEXT;
COMMENT ON COLUMN orders.paygreen_payment_id IS 'ID de paiement PayGreen pour refunds (ex: poi_xxx)';

-- 3. Colonne edenred_payment_id : ID de capture Edenred (pour refunds)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS edenred_payment_id TEXT;
COMMENT ON COLUMN orders.edenred_payment_id IS 'ID de capture Edenred pour refunds';

-- Index pour recherche rapide par moyen de paiement
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_paygreen_payment_id ON orders(paygreen_payment_id);
CREATE INDEX IF NOT EXISTS idx_orders_edenred_payment_id ON orders(edenred_payment_id);
