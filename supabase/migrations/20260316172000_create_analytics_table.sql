-- Migration: Table analytics pour agréger les stats longue durée
-- Permet de purger les vieilles commandes tout en gardant les statistiques

-- Table pour stocker les agrégats quotidiens
CREATE TABLE IF NOT EXISTS order_analytics (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,

  -- Compteurs
  total_orders INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,

  -- Revenus
  total_revenue DECIMAL(10,2) DEFAULT 0,
  avg_basket_value DECIMAL(10,2) DEFAULT 0,

  -- Moyens de paiement
  paygreen_count INTEGER DEFAULT 0,
  paygreen_revenue DECIMAL(10,2) DEFAULT 0,
  edenred_count INTEGER DEFAULT 0,
  edenred_revenue DECIMAL(10,2) DEFAULT 0,

  -- Clients
  unique_clients INTEGER DEFAULT 0,
  new_clients INTEGER DEFAULT 0,
  returning_clients INTEGER DEFAULT 0,

  -- Timing
  avg_prep_time_minutes INTEGER DEFAULT 0,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_analytics_date ON order_analytics(date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_revenue ON order_analytics(total_revenue DESC);

-- Fonction pour calculer les analytics d'une journée
CREATE OR REPLACE FUNCTION compute_daily_analytics(target_date DATE)
RETURNS TABLE(
  computed_orders INTEGER,
  computed_revenue DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_orders INTEGER;
  v_orders_completed INTEGER;
  v_orders_cancelled INTEGER;
  v_total_revenue DECIMAL(10,2);
  v_avg_basket DECIMAL(10,2);
  v_paygreen_count INTEGER;
  v_paygreen_revenue DECIMAL(10,2);
  v_edenred_count INTEGER;
  v_edenred_revenue DECIMAL(10,2);
  v_unique_clients INTEGER;
  v_new_clients INTEGER;
  v_returning_clients INTEGER;
BEGIN
  -- Calculer les métriques pour la date cible
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE statut = 'recuperee'),
    COUNT(*) FILTER (WHERE statut = 'cancelled'),
    COALESCE(SUM(total_price), 0),
    COALESCE(AVG(total_price), 0),
    COUNT(*) FILTER (WHERE payment_method = 'paygreen'),
    COALESCE(SUM(total_price) FILTER (WHERE payment_method = 'paygreen'), 0),
    COUNT(*) FILTER (WHERE payment_method = 'edenred'),
    COALESCE(SUM(total_price) FILTER (WHERE payment_method = 'edenred'), 0),
    COUNT(DISTINCT client_email),
    0, -- new clients (nécessite jointure avec clients table)
    0  -- returning clients (nécessite jointure)
  INTO
    v_total_orders,
    v_orders_completed,
    v_orders_cancelled,
    v_total_revenue,
    v_avg_basket,
    v_paygreen_count,
    v_paygreen_revenue,
    v_edenred_count,
    v_edenred_revenue,
    v_unique_clients,
    v_new_clients,
    v_returning_clients
  FROM orders
  WHERE DATE(created_at) = target_date;

  -- Insert ou update
  INSERT INTO order_analytics (
    date,
    total_orders,
    orders_completed,
    orders_cancelled,
    total_revenue,
    avg_basket_value,
    paygreen_count,
    paygreen_revenue,
    edenred_count,
    edenred_revenue,
    unique_clients,
    new_clients,
    returning_clients,
    updated_at
  ) VALUES (
    target_date,
    v_total_orders,
    v_orders_completed,
    v_orders_cancelled,
    v_total_revenue,
    v_avg_basket,
    v_paygreen_count,
    v_paygreen_revenue,
    v_edenred_count,
    v_edenred_revenue,
    v_unique_clients,
    v_new_clients,
    v_returning_clients,
    NOW()
  )
  ON CONFLICT (date) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    orders_completed = EXCLUDED.orders_completed,
    orders_cancelled = EXCLUDED.orders_cancelled,
    total_revenue = EXCLUDED.total_revenue,
    avg_basket_value = EXCLUDED.avg_basket_value,
    paygreen_count = EXCLUDED.paygreen_count,
    paygreen_revenue = EXCLUDED.paygreen_revenue,
    edenred_count = EXCLUDED.edenred_count,
    edenred_revenue = EXCLUDED.edenred_revenue,
    unique_clients = EXCLUDED.unique_clients,
    new_clients = EXCLUDED.new_clients,
    returning_clients = EXCLUDED.returning_clients,
    updated_at = NOW();

  RETURN QUERY SELECT v_total_orders, v_total_revenue;
END;
$$;

-- Fonction pour calculer les analytics de plusieurs jours (batch)
CREATE OR REPLACE FUNCTION compute_analytics_batch(
  start_date DATE,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  days_processed INTEGER,
  total_orders INTEGER,
  total_revenue DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  iter_date DATE := start_date;
  final_date DATE := COALESCE(end_date, CURRENT_DATE);
  days_count INTEGER := 0;
  orders_sum INTEGER := 0;
  revenue_sum DECIMAL(10,2) := 0;
  day_result RECORD;
BEGIN
  WHILE iter_date <= final_date LOOP
    SELECT * INTO day_result FROM compute_daily_analytics(iter_date);
    days_count := days_count + 1;
    orders_sum := orders_sum + day_result.computed_orders;
    revenue_sum := revenue_sum + day_result.computed_revenue;
    iter_date := iter_date + INTERVAL '1 day';
  END LOOP;

  RETURN QUERY SELECT days_count, orders_sum, revenue_sum;
END;
$$;

-- Modifier la fonction smart_archive_orders pour calculer les analytics avant archivage
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
  oldest_date DATE;
  analytics_result RECORD;
BEGIN
  start_time := clock_timestamp();

  -- NIVEAU 1 : Marquer commandes terminées > 30 jours (soft archive)
  UPDATE orders
  SET auto_archived_at = NOW()
  WHERE auto_archived_at IS NULL
    AND statut IN ('recuperee', 'cancelled')
    AND created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS count_level_1 = ROW_COUNT;

  -- NIVEAU 2 : Calculer analytics avant archivage complet
  -- Trouver la plus vieille commande non archivée > 1 an
  SELECT MIN(DATE(created_at)) INTO oldest_date
  FROM orders
  WHERE archived = false
    AND statut IN ('recuperee', 'cancelled')
    AND created_at < NOW() - INTERVAL '365 days';

  -- Calculer les analytics pour ces dates si nécessaire
  IF oldest_date IS NOT NULL THEN
    SELECT * INTO analytics_result
    FROM compute_analytics_batch(
      oldest_date,
      (NOW() - INTERVAL '365 days')::DATE
    );

    RAISE NOTICE '📊 Analytics calculées : % jours, % commandes, % € de CA',
      analytics_result.days_processed,
      analytics_result.total_orders,
      analytics_result.total_revenue;
  END IF;

  -- Archivage complet > 1 an
  UPDATE orders
  SET archived = true
  WHERE archived = false
    AND statut IN ('recuperee', 'cancelled')
    AND created_at < NOW() - INTERVAL '365 days';

  GET DIAGNOSTICS count_level_2 = ROW_COUNT;

  -- NIVEAU 3 : Marquer éligibles à la purge > 3 ans
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

-- Commentaires
COMMENT ON TABLE order_analytics IS 'Agrégats quotidiens pour analytics longue durée (permet purge des vieilles orders)';
COMMENT ON FUNCTION compute_daily_analytics IS 'Calcule et sauvegarde les analytics d''une journée spécifique';
COMMENT ON FUNCTION compute_analytics_batch IS 'Calcule les analytics pour une période (batch processing)';

-- Afficher résumé
DO $$
DECLARE
  analytics_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO analytics_count FROM order_analytics;

  RAISE NOTICE '';
  RAISE NOTICE '📊 TABLE ANALYTICS CRÉÉE';
  RAISE NOTICE '  ✅ order_analytics : % jours enregistrés', analytics_count;
  RAISE NOTICE '  ✅ Fonction compute_daily_analytics() : Calcul journalier';
  RAISE NOTICE '  ✅ Fonction compute_analytics_batch() : Calcul par période';
  RAISE NOTICE '  ✅ smart_archive_orders() : Mis à jour avec calcul analytics automatique';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Usage:';
  RAISE NOTICE '  SELECT compute_daily_analytics(''2026-03-01'');';
  RAISE NOTICE '  SELECT compute_analytics_batch(''2026-01-01'', ''2026-03-15'');';
  RAISE NOTICE '';
END $$;
