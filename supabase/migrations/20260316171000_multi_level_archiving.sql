-- Migration: Système d'archivage multi-niveaux pour usage longue durée
-- Permet de garder l'admin rapide même après plusieurs années d'utilisation

-- Ajouter colonnes pour archivage progressif
ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_archived_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS purge_eligible_at TIMESTAMPTZ;

-- Index composites pour performance optimale
CREATE INDEX IF NOT EXISTS idx_orders_active_list ON orders(statut, archived, created_at DESC)
  WHERE archived = false AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete');

CREATE INDEX IF NOT EXISTS idx_orders_completed_recent ON orders(statut, created_at DESC)
  WHERE statut IN ('recuperee', 'cancelled') AND archived = false;

-- Fonction d'archivage intelligent multi-niveaux
CREATE OR REPLACE FUNCTION smart_archive_orders()
RETURNS TABLE(
  level_1_hidden INTEGER,
  level_2_archived INTEGER,
  level_3_purge_eligible INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  count_level_1 INTEGER := 0;
  count_level_2 INTEGER := 0;
  count_level_3 INTEGER := 0;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  start_time := clock_timestamp();

  -- NIVEAU 1 : Marquer commandes terminées > 30 jours (soft archive)
  -- Ces commandes ne sont plus affichées dans la vue principale mais restent accessibles
  UPDATE orders
  SET auto_archived_at = NOW()
  WHERE auto_archived_at IS NULL
    AND statut IN ('recuperee', 'cancelled')
    AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS count_level_1 = ROW_COUNT;

  -- NIVEAU 2 : Archivage complet > 1 an
  -- Ces commandes ne sont plus chargées par l'admin (requiert recherche explicite)
  UPDATE orders
  SET archived = true
  WHERE archived = false
    AND statut IN ('recuperee', 'cancelled')
    AND created_at < NOW() - INTERVAL '365 days';

  GET DIAGNOSTICS count_level_2 = ROW_COUNT;

  -- NIVEAU 3 : Marquer éligibles à la purge > 3 ans
  -- Purge manuelle uniquement (sécurité : éviter suppression accidentelle)
  UPDATE orders
  SET purge_eligible_at = NOW()
  WHERE purge_eligible_at IS NULL
    AND archived = true
    AND created_at < NOW() - INTERVAL '3 years';

  GET DIAGNOSTICS count_level_3 = ROW_COUNT;

  end_time := clock_timestamp();

  -- Logger l'exécution
  INSERT INTO archive_logs (archived_count, execution_time)
  VALUES (count_level_2, end_time - start_time);

  RAISE NOTICE '📦 Niveau 1 (30j): % commandes cachées', count_level_1;
  RAISE NOTICE '🗄️  Niveau 2 (1an): % commandes archivées', count_level_2;
  RAISE NOTICE '🗑️  Niveau 3 (3ans): % commandes éligibles purge', count_level_3;

  RETURN QUERY SELECT count_level_1, count_level_2, count_level_3;
END;
$$;

-- Vue pour admin : seulement commandes récentes non archivées
CREATE OR REPLACE VIEW orders_active AS
SELECT *
FROM orders
WHERE archived = false
  AND (
    statut IN ('payee', 'acceptee', 'en_preparation', 'prete')
    OR (statut IN ('recuperee', 'cancelled') AND created_at > NOW() - INTERVAL '30 days')
  )
ORDER BY created_at DESC;

-- Vue pour historique : commandes terminées récentes (30 derniers jours)
CREATE OR REPLACE VIEW orders_recent_history AS
SELECT *
FROM orders
WHERE archived = false
  AND statut IN ('recuperee', 'cancelled')
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Vue pour recherche archives (> 30 jours, < 1 an)
CREATE OR REPLACE VIEW orders_archived_searchable AS
SELECT *
FROM orders
WHERE archived = false
  AND statut IN ('recuperee', 'cancelled')
  AND created_at BETWEEN NOW() - INTERVAL '365 days' AND NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Fonction de purge manuelle (> 3 ans)
-- Sauvegarde les stats essentielles avant suppression
CREATE OR REPLACE FUNCTION purge_old_orders(dry_run BOOLEAN DEFAULT true)
RETURNS TABLE(
  would_delete INTEGER,
  actually_deleted INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  count_to_delete INTEGER := 0;
  count_deleted INTEGER := 0;
BEGIN
  -- Compter combien seraient supprimées
  SELECT COUNT(*) INTO count_to_delete
  FROM orders
  WHERE purge_eligible_at IS NOT NULL
    AND created_at < NOW() - INTERVAL '3 years';

  IF NOT dry_run THEN
    -- Sauvegarder les stats dans order_analytics avant suppression
    -- (sera fait dans la prochaine migration)

    -- Supprimer les commandes
    DELETE FROM orders
    WHERE purge_eligible_at IS NOT NULL
      AND created_at < NOW() - INTERVAL '3 years';

    GET DIAGNOSTICS count_deleted = ROW_COUNT;

    RAISE NOTICE '🗑️  Purge exécutée : % commandes supprimées', count_deleted;
  ELSE
    RAISE NOTICE '🔍 Mode dry-run : % commandes seraient supprimées', count_to_delete;
  END IF;

  RETURN QUERY SELECT count_to_delete, count_deleted;
END;
$$;

-- Note: Configurer le cron manuellement via Dashboard Supabase
-- Dashboard → Database → Cron Jobs → Modifier le job 'archive-old-orders'
-- Command: SELECT smart_archive_orders();
-- Schedule: 0 3 * * *

-- Commentaires
COMMENT ON FUNCTION smart_archive_orders IS 'Archivage intelligent multi-niveaux (30j, 1an, 3ans)';
COMMENT ON FUNCTION purge_old_orders IS 'Purge manuelle des commandes > 3 ans (dry_run par défaut)';
COMMENT ON VIEW orders_active IS 'Vue optimisée pour l''admin : commandes en cours + historique récent (30j)';
COMMENT ON VIEW orders_recent_history IS 'Historique récent (30 derniers jours) pour onglet "Terminées"';
COMMENT ON VIEW orders_archived_searchable IS 'Archives consultables (30j-1an) pour recherche';

-- Afficher résumé
DO $$
DECLARE
  active_count INTEGER;
  history_count INTEGER;
  archived_count INTEGER;
  purge_eligible_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count FROM orders WHERE archived = false AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete');
  SELECT COUNT(*) INTO history_count FROM orders WHERE archived = false AND statut IN ('recuperee', 'cancelled') AND created_at > NOW() - INTERVAL '30 days';
  SELECT COUNT(*) INTO archived_count FROM orders WHERE archived = true;
  SELECT COUNT(*) INTO purge_eligible_count FROM orders WHERE purge_eligible_at IS NOT NULL;

  RAISE NOTICE '';
  RAISE NOTICE '📊 ÉTAT ACTUEL DE LA BASE';
  RAISE NOTICE '  ✅ Commandes actives : %', active_count;
  RAISE NOTICE '  📦 Historique récent (30j) : %', history_count;
  RAISE NOTICE '  🗄️  Archivées (>1an) : %', archived_count;
  RAISE NOTICE '  🗑️  Éligibles purge (>3ans) : %', purge_eligible_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Archivage multi-niveaux configuré';
END $$;
