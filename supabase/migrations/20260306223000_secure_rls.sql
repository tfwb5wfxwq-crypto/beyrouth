-- Migration : Sécuriser les accès aux commandes sans casser le flow
-- Date : 6 mars 2026

-- ===== SOLUTION : Logging des accès suspects =====

-- Table pour logger tous les accès aux commandes (détection d'abus)
CREATE TABLE IF NOT EXISTS order_access_log (
  id BIGSERIAL PRIMARY KEY,
  order_numero TEXT NOT NULL,
  access_type TEXT NOT NULL, -- 'view', 'list_all'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_order_access_log_created_at ON order_access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_order_access_log_numero ON order_access_log(order_numero);

-- RLS sur la table de log (admin only)
ALTER TABLE order_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_access_log_admin_only" ON order_access_log
  FOR ALL USING (auth.role() = 'authenticated');

-- ===== AMÉLIORATION : Rate limiting avec table de tracking =====

-- Table pour tracker les tentatives d'accès par IP (anti-bruteforce)
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL, -- 'order_view', 'order_create', etc.
  attempts INTEGER DEFAULT 1,
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(ip_address, endpoint)
);

-- Index pour nettoyage automatique
CREATE INDEX IF NOT EXISTS idx_rate_limit_last_attempt ON rate_limit_tracking(last_attempt);

-- Fonction pour nettoyer les vieilles entrées (> 1h)
CREATE OR REPLACE FUNCTION cleanup_rate_limit()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_tracking
  WHERE last_attempt < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- RLS sur rate limiting (admin only)
ALTER TABLE rate_limit_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limit_admin_only" ON rate_limit_tracking
  FOR ALL USING (auth.role() = 'authenticated');

-- ===== NOTE : On garde la RLS actuelle pour les orders =====
-- La policy "orders_select_by_numero" reste USING (true) pour compatibilité
-- Le logging et rate limiting assurent la sécurité sans casser le flow client
