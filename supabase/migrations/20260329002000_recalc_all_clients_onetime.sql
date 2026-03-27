-- Recalculer les stats pour TOUS les clients existants (one-time)
-- Après cette migration, les triggers prendront le relais automatiquement

DO $$
DECLARE
  client_rec RECORD;
  total_clients INT := 0;
  updated_clients INT := 0;
BEGIN
  -- Compter les clients
  SELECT COUNT(*) INTO total_clients FROM clients;
  RAISE NOTICE 'Début recalcul pour % clients...', total_clients;

  -- Boucle sur tous les clients
  FOR client_rec IN SELECT email FROM clients LOOP
    UPDATE clients
    SET
      nombre_commandes = (
        SELECT COUNT(*)
        FROM orders
        WHERE client_email = client_rec.email
          AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
      ),
      total_depense = (
        SELECT COALESCE(SUM(total), 0)
        FROM orders
        WHERE client_email = client_rec.email
          AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
      ),
      derniere_commande = (
        SELECT MAX(created_at)
        FROM orders
        WHERE client_email = client_rec.email
          AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
      )
    WHERE email = client_rec.email;

    updated_clients := updated_clients + 1;
  END LOOP;

  RAISE NOTICE 'Terminé ! % clients mis à jour.', updated_clients;
END $$;
