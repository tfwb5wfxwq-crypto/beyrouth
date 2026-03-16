-- Migration: Configuration automatique du cron job d'archivage
-- pg_cron est préinstallé sur Supabase, on configure juste le schedule

-- Créer table pour logs d'archivage
CREATE TABLE IF NOT EXISTS archive_logs (
  id BIGSERIAL PRIMARY KEY,
  archived_count INTEGER NOT NULL,
  execution_time INTERVAL,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour consultation rapide des logs
CREATE INDEX IF NOT EXISTS idx_archive_logs_executed_at ON archive_logs(executed_at DESC);

-- Fonction améliorée d'archivage avec logs
CREATE OR REPLACE FUNCTION archive_old_orders_with_logging()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  count_archived INTEGER;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := clock_timestamp();

  -- Archiver les commandes de plus de 365 jours
  UPDATE orders
  SET archived = true
  WHERE archived = false
    AND created_at < NOW() - INTERVAL '365 days'
    AND statut IN ('recuperee', 'cancelled');

  GET DIAGNOSTICS count_archived = ROW_COUNT;

  end_time := clock_timestamp();

  -- Logger l'exécution
  INSERT INTO archive_logs (archived_count, execution_time)
  VALUES (count_archived, end_time - start_time);

  RAISE NOTICE 'Archivage terminé : % commandes archivées en %', count_archived, end_time - start_time;

  RETURN count_archived;
END;
$$;

-- Note: Le cron job doit être configuré manuellement via le Dashboard Supabase
-- Dashboard → Database → Cron Jobs → Create new cron job
-- Command: SELECT archive_old_orders_with_logging();
-- Schedule: 0 3 * * *

-- Commentaires
COMMENT ON TABLE archive_logs IS 'Logs des exécutions automatiques d''archivage';
COMMENT ON FUNCTION archive_old_orders_with_logging IS 'Archive les commandes > 1 an et log l''exécution';

-- Afficher confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Fonction d''archivage créée : archive_old_orders_with_logging()';
  RAISE NOTICE '📊 Logs disponibles dans la table archive_logs';
  RAISE NOTICE '⚠️  Configurer le cron manuellement via le Dashboard (voir CRON-SETUP.md)';
END $$;
