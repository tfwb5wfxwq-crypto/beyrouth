-- Fix: permettre à l'admin (anon) de lire les clients
-- Les orders exposent déjà client_email/prenom/telephone à anon (USING true)
-- Cette policy ne crée donc pas de nouvelle surface d'attaque
DROP POLICY IF EXISTS "clients_select_auth" ON clients;
CREATE POLICY "clients_select_anon" ON clients FOR SELECT USING (true);
