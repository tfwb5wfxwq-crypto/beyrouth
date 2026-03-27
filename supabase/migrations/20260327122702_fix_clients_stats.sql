-- Fix clients stats : auto-update nombre_commandes et total_depense

-- 1. Fonction pour recalculer les stats d'un client
CREATE OR REPLACE FUNCTION update_client_stats(p_client_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE clients
  SET
    nombre_commandes = (
      SELECT COUNT(*)
      FROM orders o
      WHERE o.client_email = p_client_email
        AND o.statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
    ),
    total_depense = (
      SELECT COALESCE(SUM(o.total), 0)
      FROM orders o
      WHERE o.client_email = p_client_email
        AND o.statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
    ),
    derniere_commande = (
      SELECT MAX(o.created_at)
      FROM orders o
      WHERE o.client_email = p_client_email
        AND o.statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
    )
  WHERE email = p_client_email;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger après INSERT sur orders
CREATE OR REPLACE FUNCTION trigger_update_client_stats_after_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour les stats du client si email présent
  IF NEW.client_email IS NOT NULL THEN
    PERFORM update_client_stats(NEW.client_email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_client_stats_after_order_insert ON orders;
CREATE TRIGGER update_client_stats_after_order_insert
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_client_stats_after_order();

-- 3. Trigger après UPDATE sur orders (changement de statut)
DROP TRIGGER IF EXISTS update_client_stats_after_order_update ON orders;
CREATE TRIGGER update_client_stats_after_order_update
  AFTER UPDATE OF statut, total ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_client_stats_after_order();

-- 4. Recalculer les stats pour TOUS les clients existants
DO $$
DECLARE
  client_rec RECORD;
BEGIN
  FOR client_rec IN SELECT email FROM clients LOOP
    PERFORM update_client_stats(client_rec.email);
  END LOOP;
END $$;

-- 5. Afficher les stats après recalcul
SELECT
  email,
  prenom,
  nombre_commandes,
  total_depense,
  derniere_commande
FROM clients
ORDER BY nombre_commandes DESC, total_depense DESC;
