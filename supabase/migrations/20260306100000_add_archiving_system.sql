-- Migration: Système d'archivage pour commandes anciennes
-- Permet de garder la table orders légère en archivant les commandes de plus d'1 an

-- Ajouter colonne archived avec default false
ALTER TABLE orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Index pour performances (filtrer facilement les commandes non-archivées)
CREATE INDEX IF NOT EXISTS idx_orders_not_archived ON orders(archived, created_at DESC) WHERE archived = false;

-- Index pour les archives (quand on veut les consulter)
CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(archived, created_at DESC) WHERE archived = true;

-- Fonction pour archiver automatiquement les commandes de plus d'1 an
-- À appeler manuellement ou via un cron job
CREATE OR REPLACE FUNCTION archive_old_orders()
RETURNS TABLE(archived_count INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  count_archived INTEGER;
BEGIN
  -- Archiver les commandes de plus de 365 jours
  UPDATE orders
  SET archived = true
  WHERE archived = false
    AND created_at < NOW() - INTERVAL '365 days'
    AND statut IN ('recuperee', 'cancelled');

  GET DIAGNOSTICS count_archived = ROW_COUNT;

  RETURN QUERY SELECT count_archived;
END;
$$;

-- Commentaires
COMMENT ON COLUMN orders.archived IS 'TRUE si la commande est archivée (> 1 an). Les archives ne sont pas affichées par défaut dans l''admin.';
COMMENT ON FUNCTION archive_old_orders IS 'Archive automatiquement les commandes terminées de plus d''1 an. Retourne le nombre de commandes archivées.';
