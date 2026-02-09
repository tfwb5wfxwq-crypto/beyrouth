-- ============================================
-- BEYROUTH EXPRESS - Schema Supabase
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- 1. TABLE: clients (base de données client pour marketing)
CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  prenom TEXT,
  telephone TEXT,
  nombre_commandes INTEGER DEFAULT 0,
  total_depense NUMERIC(10,2) DEFAULT 0,
  derniere_commande TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLE: menu_categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE: ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id BIGSERIAL PRIMARY KEY,
  nom TEXT UNIQUE NOT NULL,
  disponible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE: menu_items
CREATE TABLE IF NOT EXISTS menu_items (
  id BIGSERIAL PRIMARY KEY,
  categorie_id BIGINT REFERENCES menu_categories(id),
  nom TEXT NOT NULL,
  description TEXT,
  prix NUMERIC(8,2) NOT NULL,
  emoji TEXT DEFAULT '🍽️',
  image_url TEXT,
  ingredients TEXT[] DEFAULT '{}',
  disponible BOOLEAN DEFAULT TRUE,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLE: orders
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT UNIQUE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'payee' CHECK (statut IN ('payee','acceptee','en_preparation','prete','recuperee')),
  heure_retrait TEXT,
  client_prenom TEXT,
  client_email TEXT,
  client_telephone TEXT,
  payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLE: order_items (détail pour analytics)
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id BIGINT REFERENCES menu_items(id),
  nom TEXT NOT NULL,
  prix NUMERIC(8,2) NOT NULL,
  quantite INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX pour performances
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_numero ON orders(numero);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_statut ON orders(statut);
CREATE INDEX IF NOT EXISTS idx_menu_items_categorie ON menu_items(categorie_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- ============================================
-- TRIGGER: updated_at automatique sur orders
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- menu_categories : lecture publique
CREATE POLICY "menu_categories_select" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "menu_categories_all_auth" ON menu_categories FOR ALL USING (auth.role() = 'authenticated');

-- menu_items : lecture publique
CREATE POLICY "menu_items_select" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_all_auth" ON menu_items FOR ALL USING (auth.role() = 'authenticated');

-- ingredients : lecture publique, modif authentifié
CREATE POLICY "ingredients_select" ON ingredients FOR SELECT USING (true);
CREATE POLICY "ingredients_all_auth" ON ingredients FOR ALL USING (auth.role() = 'authenticated');

-- orders : insert public (pour les clients), select/update authentifié + select par numéro
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_select_by_numero" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_all_auth" ON orders FOR ALL USING (auth.role() = 'authenticated');

-- order_items : insert public, select authentifié
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_select_auth" ON order_items FOR SELECT USING (auth.role() = 'authenticated');

-- clients : insert/update public (upsert depuis le checkout), select authentifié
CREATE POLICY "clients_upsert" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (true);
CREATE POLICY "clients_select_auth" ON clients FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- REALTIME : activer sur les tables nécessaires
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;

-- ============================================
-- DONNÉES INITIALES : Catégories
-- ============================================
INSERT INTO menu_categories (nom, emoji, ordre) VALUES
  ('Formules', '🍽️', 1),
  ('Sandwichs & Wraps', '🌯', 2),
  ('Assiettes', '🥘', 3),
  ('Mezze', '🧆', 4),
  ('Boissons', '🥤', 5),
  ('Desserts', '🍮', 6)
ON CONFLICT DO NOTHING;

-- ============================================
-- DONNÉES INITIALES : Ingrédients
-- ============================================
INSERT INTO ingredients (nom, disponible) VALUES
  ('Poulet', true),
  ('Bœuf', true),
  ('Agneau', true),
  ('Pois chiches', true),
  ('Tahini', true),
  ('Pain libanais', true),
  ('Riz', true),
  ('Boulgour', true),
  ('Tomates', true),
  ('Oignons', true),
  ('Persil', true),
  ('Menthe', true),
  ('Aubergine', true),
  ('Concombre', true),
  ('Salade', true),
  ('Pickles', true),
  ('Pistaches', true),
  ('Miel', true),
  ('Dattes', true),
  ('Yaourt', true)
ON CONFLICT (nom) DO NOTHING;

-- ============================================
-- DONNÉES INITIALES : Menu items
-- ============================================
INSERT INTO menu_items (categorie_id, nom, description, prix, emoji, ingredients, disponible) VALUES
  -- Formules
  (1, 'Formule Midi', 'Sandwich ou wrap + boisson + dessert du jour', 10.90, '🍽️', ARRAY['Pain libanais'], true),
  (1, 'Formule Assiette', 'Assiette au choix + boisson', 13.90, '🥗', ARRAY['Riz'], true),
  -- Sandwichs & Wraps
  (2, 'Shawarma Poulet', 'Pain libanais, poulet mariné, tomates, oignons, sauce tarator', 7.50, '🌯', ARRAY['Poulet','Pain libanais','Tomates','Oignons','Tahini'], true),
  (2, 'Shawarma Bœuf', 'Pain libanais, bœuf épicé, pickles, sauce tahini', 8.50, '🌯', ARRAY['Bœuf','Pain libanais','Pickles','Tahini'], true),
  (2, 'Falafel Wrap', 'Falafels maison, salade, houmous, sauce tahini', 7.00, '🧆', ARRAY['Pois chiches','Pain libanais','Salade','Tahini'], true),
  (2, 'Wrap Mixte', 'Poulet et bœuf, légumes grillés, sauce à l''ail', 9.00, '🌯', ARRAY['Poulet','Bœuf','Pain libanais'], true),
  -- Assiettes
  (3, 'Assiette Shawarma Poulet', 'Riz, shawarma poulet, salade, houmous, sauce tarator', 11.50, '🍗', ARRAY['Poulet','Riz','Salade','Pois chiches','Tahini'], true),
  (3, 'Assiette Shawarma Bœuf', 'Riz, shawarma bœuf, taboulé, pickles, sauce tahini', 12.50, '🥩', ARRAY['Bœuf','Riz','Boulgour','Pickles','Tahini'], true),
  (3, 'Assiette Falafel', 'Riz, falafels maison, salade, houmous, sauce tahini', 10.50, '🧆', ARRAY['Pois chiches','Riz','Salade','Tahini'], true),
  (3, 'Assiette Mixte', 'Riz, poulet, bœuf, falafel, houmous, taboulé', 14.00, '🥘', ARRAY['Poulet','Bœuf','Pois chiches','Riz','Boulgour'], true),
  (3, 'Assiette Kefta', 'Riz, brochettes de kefta, salade, sauce à l''ail', 12.00, '🍢', ARRAY['Bœuf','Riz','Salade'], true),
  -- Mezze
  (4, 'Houmous', 'Purée de pois chiches, tahini, huile d''olive, pain libanais', 4.50, '🫘', ARRAY['Pois chiches','Tahini','Pain libanais'], true),
  (4, 'Taboulé Libanais', 'Persil, boulgour, tomates, menthe, citron', 4.50, '🥗', ARRAY['Persil','Boulgour','Tomates','Menthe'], true),
  (4, 'Fattouch', 'Salade croquante, pain frit, sumac, grenade', 5.00, '🥬', ARRAY['Salade','Pain libanais','Tomates'], true),
  (4, 'Moutabal', 'Caviar d''aubergine fumée, tahini, ail', 4.50, '🍆', ARRAY['Aubergine','Tahini'], true),
  (4, 'Falafels (6 pcs)', 'Boulettes de pois chiches épicées, sauce tahini', 5.50, '🧆', ARRAY['Pois chiches','Tahini'], true),
  -- Boissons
  (5, 'Ayran', 'Boisson au yaourt salé, rafraîchissante', 2.50, '🥛', ARRAY['Yaourt'], true),
  (5, 'Jus de Citron Menthe', 'Citron frais pressé, menthe, sucre', 3.50, '🍋', ARRAY['Menthe'], true),
  (5, 'Coca-Cola / Sprite', '33cl', 2.00, '🥤', ARRAY[]::text[], true),
  (5, 'Eau Minérale', '50cl', 1.50, '💧', ARRAY[]::text[], true),
  -- Desserts
  (6, 'Baklava (2 pcs)', 'Pâte filo, pistaches, miel', 3.50, '🍯', ARRAY['Pistaches','Miel'], true),
  (6, 'Maamoul', 'Sablé libanais aux dattes', 2.50, '🍪', ARRAY['Dattes'], true)
ON CONFLICT DO NOTHING;
