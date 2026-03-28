-- Insert commande de test pour tester emails
INSERT INTO orders (
  numero,
  client_prenom,
  client_email,
  client_telephone,
  statut,
  items,
  total,
  heure_retrait,
  note,
  paygreen_transaction_id,
  payment_confirmed_at
) VALUES (
  'TEST ' || TO_CHAR(NOW(), 'HH24MI'),
  'Ludovic',
  'ludovikh@gmail.com',
  '+33612345678',
  'acceptee',
  '[{"id": 1, "nom": "Falafel Sandwich", "prix": 6.90, "quantite": 1}]'::jsonb,
  690,
  'asap',
  'Test emails',
  'test_' || EXTRACT(EPOCH FROM NOW())::TEXT,
  NOW()
);
