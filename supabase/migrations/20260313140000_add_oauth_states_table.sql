-- Table pour stocker les states OAuth temporaires (protection CSRF)
CREATE TABLE IF NOT EXISTS oauth_states (
  id BIGSERIAL PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  order_num TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Index pour cleanup automatique
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Fonction de cleanup automatique des states expirés (appelée toutes les heures)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Policies RLS (seulement service_role peut accéder)
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oauth_states_service_role_only" ON oauth_states
USING (auth.role() = 'service_role');
