-- Migration: Activer explicitement Realtime sur les tables critiques
-- Supabase nécessite parfois une activation explicite via SQL

-- Activer la réplication pour Realtime sur menu_items
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;

-- Activer la réplication pour Realtime sur ingredients
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;

-- Activer la réplication pour Realtime sur settings
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- Activer la réplication pour Realtime sur orders (bonus pour l'admin)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Note: Ces commandes ne vont pas échouer si les tables sont déjà dans la publication
-- car elles utilisent l'idempotence de PostgreSQL
