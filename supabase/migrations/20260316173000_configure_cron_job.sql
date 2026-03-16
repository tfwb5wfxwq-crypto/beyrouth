-- Migration: Configuration du cron job pour archivage automatique
-- Configure pg_cron pour exécuter smart_archive_orders() tous les jours à 3h UTC

-- Activer l'extension pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Supprimer les anciens jobs s'ils existent
DO $$
BEGIN
  PERFORM cron.unschedule('archive-old-orders') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'archive-old-orders'
  );
  PERFORM cron.unschedule('smart-archive-orders') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'smart-archive-orders'
  );
END $$;

-- Créer le nouveau cron job
SELECT cron.schedule(
  'smart-archive-orders',              -- nom du job
  '0 3 * * *',                         -- tous les jours à 3h UTC
  $$SELECT smart_archive_orders()$$   -- commande à exécuter
);

-- Afficher confirmation
DO $$
DECLARE
  job_info RECORD;
BEGIN
  SELECT jobid, jobname, schedule, command, active
  INTO job_info
  FROM cron.job
  WHERE jobname = 'smart-archive-orders';

  IF FOUND THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ CRON JOB CONFIGURÉ';
    RAISE NOTICE '  Job ID: %', job_info.jobid;
    RAISE NOTICE '  Nom: %', job_info.jobname;
    RAISE NOTICE '  Schedule: % (3h UTC tous les jours)', job_info.schedule;
    RAISE NOTICE '  Commande: %', job_info.command;
    RAISE NOTICE '  Actif: %', job_info.active;
    RAISE NOTICE '';
    RAISE NOTICE '📅 Prochaine exécution: demain à 3h00 UTC (4h00 Paris hiver, 5h00 Paris été)';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '⚠️  Cron job non trouvé après création';
  END IF;
END $$;
