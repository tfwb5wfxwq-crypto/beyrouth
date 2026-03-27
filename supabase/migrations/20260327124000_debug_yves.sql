-- Debug pourquoi Yves a 0€ de dépense

-- 1. Voir Yves dans clients
SELECT email, prenom, nombre_commandes, total_depense FROM clients WHERE LOWER(prenom) LIKE '%yves%';

-- 2. Voir toutes les commandes de Yves
SELECT
  numero,
  client_prenom,
  client_email,
  statut,
  total,
  created_at
FROM orders
WHERE LOWER(client_prenom) LIKE '%yves%'
ORDER BY created_at DESC;

-- 3. Recalculer manuellement les stats de Yves
DO $$
DECLARE
  yves_email TEXT;
BEGIN
  -- Trouver l'email de Yves
  SELECT email INTO yves_email FROM clients WHERE LOWER(prenom) LIKE '%yves%' LIMIT 1;

  IF yves_email IS NOT NULL THEN
    PERFORM update_client_stats(yves_email);
    RAISE NOTICE 'Stats de Yves recalculées pour email: %', yves_email;
  ELSE
    RAISE NOTICE 'Yves introuvable dans la table clients';
  END IF;
END $$;

-- 4. Vérifier après recalcul
SELECT email, prenom, nombre_commandes, total_depense FROM clients WHERE LOWER(prenom) LIKE '%yves%';
