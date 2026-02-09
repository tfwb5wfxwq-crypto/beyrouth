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
-- DONNÉES INITIALES : Catégories (menu réel A Beyrouth)
-- ============================================
DELETE FROM menu_items;
DELETE FROM menu_categories;

INSERT INTO menu_categories (id, nom, emoji, ordre) VALUES
  (1, 'Sandwichs', '🌯', 1),
  (2, 'Formules Sandwich', '🍽️', 2),
  (3, 'Grillades', '🔥', 3),
  (4, 'Plateaux Composés', '🥘', 4),
  (5, 'Entrées Froides', '🧆', 5),
  (6, 'Desserts', '🍮', 6),
  (7, 'Boissons', '🥤', 7);

-- ============================================
-- DONNÉES INITIALES : Ingrédients
-- ============================================
INSERT INTO ingredients (nom, disponible) VALUES
  ('Poulet', true),
  ('Boeuf', true),
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
  ('Salade', true),
  ('Pistaches', true),
  ('Semoule', true),
  ('Yaourt', true),
  ('Fèves', true),
  ('Chou fleur', true),
  ('Foie de volaille', true)
ON CONFLICT (nom) DO NOTHING;

-- ============================================
-- DONNÉES INITIALES : Menu items (menu réel A Beyrouth)
-- ============================================
INSERT INTO menu_items (categorie_id, nom, description, prix, emoji, image_url, ingredients, disponible) VALUES
  -- Sandwichs (tous à 8.90€, composés de crudités + sauce maison)
  (1, 'Shawarma Poulet', 'Émincé de poulet mariné, crudités, sauce maison', 8.90, '🌯', 'img/sandwich-shawarma.jpg', ARRAY['Poulet','Pain libanais'], true),
  (1, 'Chich Taouk', 'Brochette de blanc de poulet mariné, crudités, sauce maison', 8.90, '🌯', NULL, ARRAY['Poulet','Pain libanais'], true),
  (1, 'Shawarma Boeuf', 'Émincé de boeuf mariné, crudités, sauce maison', 8.90, '🌯', NULL, ARRAY['Boeuf','Pain libanais'], true),
  (1, 'Falafel', 'Boulette de fèves, pois chiches, crudités, sauce maison', 8.90, '🧆', 'img/sandwich-falafel.jpg', ARRAY['Pois chiches','Fèves','Pain libanais'], true),
  (1, 'Veggie', 'Chou fleur, aubergine, crudités, sauce maison', 8.90, '🥬', NULL, ARRAY['Chou fleur','Aubergine','Pain libanais'], true),
  (1, 'Foie de Volaille', 'Mariné au citron, crudités, sauce maison', 8.90, '🍗', NULL, ARRAY['Foie de volaille','Pain libanais'], true),
  (1, 'Kafta', 'Brochette de boeuf hachée persillée, crudités, sauce maison', 8.90, '🍢', NULL, ARRAY['Boeuf','Pain libanais'], true),
  (1, 'Soujouk', 'Saucisses de boeuf épicées, crudités, sauce maison', 8.90, '🌭', NULL, ARRAY['Boeuf','Pain libanais'], true),

  -- Formules Sandwich
  (2, 'Formule 1', 'Sandwich + 2 feuilletés (fromage, boeuf, épinard ou falafel) + 1 boisson', 10.90, '1️⃣', NULL, ARRAY[]::text[], true),
  (2, 'Formule 2', 'Sandwich + 1 entrée froide (houmous, moutabal ou taboulé) + 1 boisson', 11.70, '2️⃣', NULL, ARRAY[]::text[], true),
  (2, 'Formule 3', 'Sandwich + 1 dessert (baklawas ou mouhalabieh) + 1 boisson', 11.70, '3️⃣', NULL, ARRAY[]::text[], true),
  (2, 'Formule 4', '2 sandwiches au choix + 1 boisson', 14.90, '4️⃣', NULL, ARRAY[]::text[], true),
  (2, 'Formule Plat du Jour', 'Plat du jour + boisson', 13.50, '🍽️', 'img/plat-jour.jpg', ARRAY[]::text[], true),

  -- Grillades (servies avec riz et crudités)
  (3, 'Kafta Méchoui', '2 brochettes de viande de boeuf hachée persillée au four, riz, crudités', 13.00, '🍢', NULL, ARRAY['Boeuf','Riz'], true),
  (3, 'Chich Taouk', '2 brochettes de blanc de poulet mariné au citron, riz, crudités', 13.00, '🍗', NULL, ARRAY['Poulet','Riz'], true),
  (3, 'Shawarma Poulet', 'Émincé de poulet mariné et grillé à la broche, riz, crudités', 14.00, '🌯', NULL, ARRAY['Poulet','Riz'], true),
  (3, 'Shawarma Boeuf', 'Émincé de boeuf mariné et grillé à la broche, riz, crudités', 15.00, '🌯', NULL, ARRAY['Boeuf','Riz'], true),
  (3, 'Grillade Mixte', 'Shawarma poulet, kafta, chich taouk, riz, crudités', 15.00, '🔥', NULL, ARRAY['Poulet','Boeuf','Riz'], true),

  -- Plateaux Composés (+2€ la boisson)
  (4, 'Beyrouth Poulet', 'Houmous, moutabal, taboulé, chawarma poulet, riz', 14.00, '🥘', NULL, ARRAY['Poulet','Riz','Pois chiches','Aubergine','Boulgour'], true),
  (4, 'Beyrouth Boeuf', 'Houmous, moutabal, taboulé, chawarma boeuf, riz', 15.00, '🥘', NULL, ARRAY['Boeuf','Riz','Pois chiches','Aubergine','Boulgour'], true),
  (4, 'Végétarienne', 'Houmous, moutabal, moussaka, crudités, 3 feuilletés végétariens', 14.00, '🥬', NULL, ARRAY['Pois chiches','Aubergine'], true),
  (4, 'Falafel', 'Houmous, moutabal, taboulé, crudités, 3 falafels', 14.00, '🧆', 'img/falafel.jpg', ARRAY['Pois chiches','Fèves','Aubergine','Boulgour'], true),
  (4, 'Liban', 'Houmous, moutabal, chich taouk, riz, crudités, 2 feuilletés végétariens', 16.00, '🇱🇧', NULL, ARRAY['Poulet','Riz','Pois chiches','Aubergine'], true),
  (4, 'Byblos', 'Houmous, moutabal, taboulé, kafta, chich taouk, shawarma poulet, riz', 18.00, '👑', NULL, ARRAY['Poulet','Boeuf','Riz','Pois chiches','Aubergine','Boulgour'], true),

  -- Entrées Froides
  (5, 'Houmous', 'Purée de pois chiches, tahini, huile d''olive', 4.50, '🫘', 'img/houmous.jpg', ARRAY['Pois chiches','Tahini'], true),
  (5, 'Moutabal', 'Caviar d''aubergine fumée, tahini, grenade', 4.50, '🍆', 'img/moutabal.jpg', ARRAY['Aubergine','Tahini'], true),
  (5, 'Taboulé', 'Persil, boulgour, tomates, menthe, citron', 4.50, '🥗', 'img/taboule.jpg', ARRAY['Persil','Boulgour','Tomates','Menthe'], true),

  -- Desserts
  (6, 'Mouhalabieh', 'Flan au lait parfumé à la fleur d''oranger et éclats de pistaches (fait maison)', 4.00, '🍮', 'img/mouhalabieh.jpg', ARRAY['Pistaches'], true),
  (6, 'Namoura', 'Gâteau de semoule parfumé à la fleur d''oranger et nappé d''un sirop léger', 4.00, '🍰', 'img/namoura.jpg', ARRAY['Semoule'], true),
  (6, 'Baklawas', 'Boîte de 3 pièces', 4.50, '🍯', NULL, ARRAY['Pistaches'], true),
  (6, 'Duo Sablés', 'Deux sablés au choix : pistaches, amandes, noix, dattes', 5.00, '🍪', NULL, ARRAY[]::text[], true),

  -- Boissons
  (7, 'Soft 33cl', 'Coca, Sprite, Orangina...', 2.00, '🥤', NULL, ARRAY[]::text[], true),
  (7, 'Ayran', 'Boisson au yaourt salé, rafraîchissante', 2.50, '🥛', NULL, ARRAY['Yaourt'], true),
  (7, 'Eau Plate', '50cl', 2.00, '💧', NULL, ARRAY[]::text[], true);
