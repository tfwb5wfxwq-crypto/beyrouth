-- Populate clients table depuis orders existantes

-- Insérer tous les clients uniques depuis orders
INSERT INTO clients (email, prenom, telephone, nombre_commandes, total_depense, derniere_commande, created_at)
SELECT DISTINCT ON (o.client_email)
  o.client_email as email,
  o.client_prenom as prenom,
  o.client_telephone as telephone,
  0 as nombre_commandes,  -- Sera recalculé par trigger
  0 as total_depense,     -- Sera recalculé par trigger
  o.created_at as derniere_commande,
  o.created_at as created_at
FROM orders o
WHERE o.client_email IS NOT NULL
  AND o.client_email != ''
  AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.email = o.client_email)
ORDER BY o.client_email, o.created_at ASC;

-- Recalculer les stats pour tous les clients
DO $$
DECLARE
  client_rec RECORD;
BEGIN
  FOR client_rec IN SELECT email FROM clients LOOP
    PERFORM update_client_stats(client_rec.email);
  END LOOP;
END $$;

-- Afficher résultat
SELECT email, prenom, nombre_commandes, total_depense FROM clients ORDER BY nombre_commandes DESC;
