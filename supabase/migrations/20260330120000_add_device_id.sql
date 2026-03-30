-- Ajouter colonne device_id pour identifier de manière unique chaque appareil
-- Une session = un device (comme Facebook/YouTube)

ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Index pour recherche rapide par device_id
CREATE INDEX IF NOT EXISTS idx_admin_sessions_device_id
  ON admin_sessions(device_id);

-- Commentaire
COMMENT ON COLUMN admin_sessions.device_id IS 'UUID unique généré côté client pour identifier chaque appareil (persisté dans localStorage)';
