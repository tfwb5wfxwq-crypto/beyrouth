-- Activer REALTIME sur les tables pour notifications temps réel

-- Fonction helper pour ajouter une table à la publication seulement si elle n'y est pas déjà
DO $$
DECLARE
  tables_to_add TEXT[] := ARRAY['orders', 'ingredients', 'menu_items', 'settings'];
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY tables_to_add
  LOOP
    -- Vérifier si la table est déjà dans la publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = table_name
    ) THEN
      -- Ajouter la table
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', table_name);
      RAISE NOTICE 'Added table % to supabase_realtime', table_name;
    ELSE
      RAISE NOTICE 'Table % already in supabase_realtime', table_name;
    END IF;
  END LOOP;
END $$;
