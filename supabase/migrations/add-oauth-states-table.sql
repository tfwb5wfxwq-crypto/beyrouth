-- Table pour stocker les tokens CSRF OAuth Edenred (protection contre attaques)
CREATE TABLE IF NOT EXISTS oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,  -- Token CSRF (UNIQUE crée automatiquement un index)
  order_num TEXT NOT NULL,     -- Numéro de commande associé
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '15 minutes')
);

-- Index pour optimiser le nettoyage des vieux tokens
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Index pour recherche par order_num (utile pour debug)
CREATE INDEX IF NOT EXISTS idx_oauth_states_order_num ON oauth_states(order_num);

-- Fonction pour nettoyer automatiquement les tokens expirés (évite surcharge)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS trigger AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger qui nettoie avant chaque insertion (léger, pas de cron nécessaire)
DROP TRIGGER IF EXISTS trigger_cleanup_oauth_states ON oauth_states;
CREATE TRIGGER trigger_cleanup_oauth_states
  BEFORE INSERT ON oauth_states
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_oauth_states();

-- Policy RLS (si activé sur le projet)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role peut tout faire (Edge Functions utilisent service_role_key)
CREATE POLICY "Service role full access" ON oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
