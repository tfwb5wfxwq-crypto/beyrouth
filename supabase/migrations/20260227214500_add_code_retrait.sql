-- Migration: Ajouter code de retrait à 4 chiffres pour chaque commande

-- Ajouter colonne code_retrait dans orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS code_retrait VARCHAR(4);

-- Créer un index pour recherche rapide par code
CREATE INDEX IF NOT EXISTS idx_orders_code_retrait ON orders(code_retrait);

-- Fonction pour générer un code unique à 4 chiffres
CREATE OR REPLACE FUNCTION generate_code_retrait()
RETURNS VARCHAR(4) AS $$
DECLARE
  new_code VARCHAR(4);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Générer un code entre 1000 et 9999 (évite 0000-0999 pour faciliter la lecture)
    new_code := LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');

    -- Vérifier si le code existe déjà aujourd'hui
    SELECT EXISTS(
      SELECT 1 FROM orders
      WHERE code_retrait = new_code
      AND created_at::date = CURRENT_DATE
    ) INTO code_exists;

    -- Si le code n'existe pas, on le retourne
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Générer des codes pour les commandes existantes (si besoin)
UPDATE orders
SET code_retrait = LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0')
WHERE code_retrait IS NULL;

-- Trigger pour générer automatiquement le code lors de l'insertion
CREATE OR REPLACE FUNCTION set_code_retrait()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code_retrait IS NULL THEN
    NEW.code_retrait := generate_code_retrait();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_set_code_retrait ON orders;
CREATE TRIGGER trigger_set_code_retrait
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_code_retrait();
