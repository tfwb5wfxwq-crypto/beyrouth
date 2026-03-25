-- Migration: Trigger automatique pour envoi emails de confirmation
-- Date: 25 mars 2026
-- But: Garantir que les emails sont TOUJOURS envoyés quand commande acceptée

-- 1. Activer extension pg_net (pour faire des requêtes HTTP depuis Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Fonction trigger pour envoyer email automatiquement
CREATE OR REPLACE FUNCTION trigger_send_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhidWZ0ZndjeW9udGdxYmJycmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2Njg1NzksImV4cCI6MjA4NjI0NDU3OX0.ROkSccADlpLsWMgqyiX_xNaFdJNR8P4R-LJCnZV2Gzg';
  response_id BIGINT;
BEGIN
  -- Conditions : statut passe à "acceptee" ET email pas encore envoyé
  IF NEW.statut = 'acceptee' AND
     (OLD IS NULL OR OLD.statut != 'acceptee') AND
     NEW.confirmation_email_sent_at IS NULL THEN

    -- Log pour debug
    RAISE NOTICE 'Trigger email confirmation pour commande % (ID %)', NEW.numero, NEW.id;

    -- Appeler Edge Function send-order-confirmation via pg_net
    -- Note: pg_net.http_post est asynchrone, donc ne bloque pas la transaction
    SELECT net.http_post(
      url := 'https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/send-order-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('orderId', NEW.id)
    ) INTO response_id;

    -- Log du response_id pour debug
    RAISE NOTICE 'HTTP request ID: %', response_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Supprimer ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_order_accepted ON orders;

-- 4. Créer trigger sur UPDATE du statut
CREATE TRIGGER on_order_accepted
  AFTER UPDATE OF statut ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_confirmation_email();

-- 5. Commentaire pour documentation
COMMENT ON FUNCTION trigger_send_confirmation_email() IS
  'Envoie automatiquement un email de confirmation quand une commande passe au statut "acceptee". Utilise pg_net pour appeler l''Edge Function send-order-confirmation de manière asynchrone.';

COMMENT ON TRIGGER on_order_accepted ON orders IS
  'Déclenche l''envoi automatique d''email de confirmation quand le statut d''une commande devient "acceptee".';
