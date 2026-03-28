-- Fix commande Yves 7539 WG : annulée par erreur alors que payée sur PayGreen
-- Changer statut cancelled → payee (sans email)

UPDATE orders
SET statut = 'payee'
WHERE numero = '7539 WG'
  AND client_email = 'yvescouarnec@gmail.com';

-- Recalculer les stats de Yves
UPDATE clients
SET
  nombre_commandes = (
    SELECT COUNT(*)
    FROM orders
    WHERE client_email = 'yvescouarnec@gmail.com'
      AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
  ),
  total_depense = (
    SELECT COALESCE(SUM(total), 0)
    FROM orders
    WHERE client_email = 'yvescouarnec@gmail.com'
      AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
  ),
  derniere_commande = (
    SELECT MAX(created_at)
    FROM orders
    WHERE client_email = 'yvescouarnec@gmail.com'
      AND statut IN ('payee', 'acceptee', 'en_preparation', 'prete', 'recuperee')
  )
WHERE email = 'yvescouarnec@gmail.com';

-- Vérifier
SELECT numero, statut, total FROM orders WHERE numero = '7539 WG';
SELECT email, prenom, nombre_commandes, total_depense FROM clients WHERE email = 'yvescouarnec@gmail.com';
