-- Fix: créer le client automatiquement à chaque INSERT sur orders
-- Le trigger existant ne faisait qu'un UPDATE (si client existait déjà)
-- Ce fix ajoute un INSERT ON CONFLICT DO NOTHING pour garantir la création
-- Tourne en SECURITY DEFINER → bypass RLS (anon ne peut pas insérer dans clients)

CREATE OR REPLACE FUNCTION trigger_update_client_stats_after_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_email IS NOT NULL THEN
    -- Créer le client s'il n'existe pas encore (depuis les données de la commande)
    INSERT INTO clients (email, prenom, telephone, optin_promo, created_at, derniere_commande)
    VALUES (
      NEW.client_email,
      COALESCE(NEW.client_prenom, 'Client'),
      NEW.client_telephone,
      false,
      NEW.created_at,
      NEW.created_at
    )
    ON CONFLICT (email) DO NOTHING;
    -- Ne pas écraser les données existantes (prenom, optin mis à jour en dehors)

    -- Mettre à jour les stats (nombre_commandes, total_depense, derniere_commande)
    PERFORM update_client_stats(NEW.client_email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
