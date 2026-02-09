-- =============================================
-- BEYROUTH EXPRESS - Seed Menu Data
-- Coller dans Supabase SQL Editor et exécuter
-- =============================================

-- 1. Nettoyer les données existantes
DELETE FROM menu_items;
DELETE FROM menu_categories;
DELETE FROM ingredients;

-- 2. Reset des séquences
ALTER SEQUENCE menu_categories_id_seq RESTART WITH 1;
ALTER SEQUENCE menu_items_id_seq RESTART WITH 1;
ALTER SEQUENCE ingredients_id_seq RESTART WITH 1;

-- 3. Catégories
INSERT INTO menu_categories (id, nom, emoji, ordre, actif) VALUES
  (1, 'Sandwichs', '🌯', 1, true),
  (2, 'Formules', '🍽️', 2, true),
  (3, 'Grillades', '🔥', 3, true),
  (4, 'Plateaux', '🥘', 4, true),
  (5, 'Entrées', '🧆', 5, true),
  (6, 'Desserts', '🍮', 6, true),
  (7, 'Boissons', '🥤', 7, true);

-- 4. Ingrédients (pour toggle dispo temps réel par Paco)
INSERT INTO ingredients (nom, disponible) VALUES
  ('Poulet', true),
  ('Boeuf', true),
  ('Pois chiches', true),
  ('Fèves', true),
  ('Tahini', true),
  ('Pain libanais', true),
  ('Riz', true),
  ('Boulgour', true),
  ('Tomates', true),
  ('Persil', true),
  ('Menthe', true),
  ('Aubergine', true),
  ('Chou fleur', true),
  ('Foie de volaille', true),
  ('Pistaches', true),
  ('Semoule', true),
  ('Yaourt', true);

-- 5. Menu items complet
INSERT INTO menu_items (categorie_id, nom, description, prix, emoji, image_url, ingredients, disponible, actif) VALUES
  -- SANDWICHS (8.90€, crudités + sauce maison)
  (1, 'Shawarma Poulet', 'Émincé de poulet mariné, crudités, sauce maison', 8.90, '🌯', 'img/sandwich-shawarma.jpg', ARRAY['Poulet','Pain libanais'], true, true),
  (1, 'Chich Taouk', 'Brochette de blanc de poulet mariné', 8.90, '🌯', NULL, ARRAY['Poulet','Pain libanais'], true, true),
  (1, 'Shawarma Boeuf', 'Émincé de boeuf mariné, crudités, sauce maison', 8.90, '🌯', NULL, ARRAY['Boeuf','Pain libanais'], true, true),
  (1, 'Falafel', 'Boulette de fèves et pois chiches', 8.90, '🧆', 'img/sandwich-falafel.jpg', ARRAY['Pois chiches','Fèves','Pain libanais'], true, true),
  (1, 'Veggie', 'Chou fleur, aubergine, crudités', 8.90, '🥬', NULL, ARRAY['Chou fleur','Aubergine','Pain libanais'], true, true),
  (1, 'Foie de Volaille', 'Mariné au citron', 8.90, '🍗', NULL, ARRAY['Foie de volaille','Pain libanais'], true, true),
  (1, 'Kafta', 'Brochette de boeuf hachée persillée', 8.90, '🍢', NULL, ARRAY['Boeuf','Pain libanais'], true, true),
  (1, 'Soujouk', 'Saucisses de boeuf épicées', 8.90, '🌭', NULL, ARRAY['Boeuf','Pain libanais'], true, true),

  -- FORMULES
  (2, 'Formule 1', 'Sandwich + 2 feuilletés + boisson', 10.90, '1️⃣', NULL, ARRAY[]::text[], true, true),
  (2, 'Formule 2', 'Sandwich + entrée froide + boisson', 11.70, '2️⃣', NULL, ARRAY[]::text[], true, true),
  (2, 'Formule 3', 'Sandwich + dessert + boisson', 11.70, '3️⃣', NULL, ARRAY[]::text[], true, true),
  (2, 'Formule 4', '2 sandwiches au choix + boisson', 14.90, '4️⃣', NULL, ARRAY[]::text[], true, true),
  (2, 'Formule Plat du Jour', 'Plat du jour + boisson', 13.50, '🍽️', 'img/plat-jour.jpg', ARRAY[]::text[], true, true),

  -- GRILLADES (avec riz et crudités)
  (3, 'Kafta Méchoui', '2 brochettes boeuf, riz, crudités', 13.00, '🍢', NULL, ARRAY['Boeuf','Riz'], true, true),
  (3, 'Chich Taouk', '2 brochettes poulet, riz, crudités', 13.00, '🍗', NULL, ARRAY['Poulet','Riz'], true, true),
  (3, 'Shawarma Poulet', 'Poulet grillé à la broche, riz, crudités', 14.00, '🌯', NULL, ARRAY['Poulet','Riz'], true, true),
  (3, 'Shawarma Boeuf', 'Boeuf grillé à la broche, riz, crudités', 15.00, '🌯', NULL, ARRAY['Boeuf','Riz'], true, true),
  (3, 'Grillade Mixte', 'Shawarma, kafta, chich taouk, riz', 15.00, '🔥', NULL, ARRAY['Poulet','Boeuf','Riz'], true, true),

  -- PLATEAUX COMPOSÉS (+2€ la boisson)
  (4, 'Beyrouth Poulet', 'Houmous, moutabal, taboulé, shawarma poulet, riz', 14.00, '🥘', NULL, ARRAY['Poulet','Riz','Pois chiches','Aubergine','Boulgour'], true, true),
  (4, 'Beyrouth Boeuf', 'Houmous, moutabal, taboulé, shawarma boeuf, riz', 15.00, '🥘', NULL, ARRAY['Boeuf','Riz','Pois chiches','Aubergine','Boulgour'], true, true),
  (4, 'Végétarienne', 'Houmous, moutabal, moussaka, 3 feuilletés', 14.00, '🥬', NULL, ARRAY['Pois chiches','Aubergine'], true, true),
  (4, 'Falafel', 'Houmous, moutabal, taboulé, 3 falafels', 14.00, '🧆', 'img/falafel.jpg', ARRAY['Pois chiches','Fèves','Aubergine','Boulgour'], true, true),
  (4, 'Liban', 'Houmous, moutabal, chich taouk, riz, 2 feuilletés', 16.00, '🇱🇧', NULL, ARRAY['Poulet','Riz','Pois chiches','Aubergine'], true, true),
  (4, 'Byblos', 'Le plateau complet : houmous, taboulé, kafta, chich taouk, shawarma, riz', 18.00, '👑', NULL, ARRAY['Poulet','Boeuf','Riz','Pois chiches','Aubergine','Boulgour'], true, true),

  -- ENTRÉES FROIDES
  (5, 'Houmous', 'Pois chiches, tahini, huile d''olive', 4.50, '🫘', 'img/houmous.jpg', ARRAY['Pois chiches','Tahini'], true, true),
  (5, 'Moutabal', 'Aubergine fumée, tahini, grenade', 4.50, '🍆', 'img/moutabal.jpg', ARRAY['Aubergine','Tahini'], true, true),
  (5, 'Taboulé', 'Persil, boulgour, tomates, menthe', 4.50, '🥗', 'img/taboule.jpg', ARRAY['Persil','Boulgour','Tomates','Menthe'], true, true),

  -- DESSERTS
  (6, 'Mouhalabieh', 'Flan fleur d''oranger, pistaches (fait maison)', 4.00, '🍮', 'img/mouhalabieh.jpg', ARRAY['Pistaches'], true, true),
  (6, 'Namoura', 'Gâteau de semoule, sirop fleur d''oranger', 4.00, '🍰', 'img/namoura.jpg', ARRAY['Semoule'], true, true),
  (6, 'Baklawas', 'Boîte de 3 pièces', 4.50, '🍯', NULL, ARRAY['Pistaches'], true, true),
  (6, 'Duo Sablés', '2 sablés : pistaches, amandes, noix ou dattes', 5.00, '🍪', NULL, ARRAY[]::text[], true, true),

  -- BOISSONS
  (7, 'Soft 33cl', 'Coca, Sprite, Orangina...', 2.00, '🥤', NULL, ARRAY[]::text[], true, true),
  (7, 'Ayran', 'Yaourt salé, rafraîchissant', 2.50, '🥛', NULL, ARRAY['Yaourt'], true, true),
  (7, 'Eau Plate', '50cl', 2.00, '💧', NULL, ARRAY[]::text[], true, true);

-- Vérification
SELECT 'Catégories: ' || count(*) FROM menu_categories
UNION ALL
SELECT 'Items: ' || count(*) FROM menu_items
UNION ALL
SELECT 'Ingrédients: ' || count(*) FROM ingredients;
