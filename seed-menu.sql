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

-- 3. Catégories (alignées sur DEMO_CATEGORIES)
INSERT INTO menu_categories (id, nom, emoji, ordre, actif) VALUES
  (1, 'Sandwichs', '🌯', 2, true),
  (2, 'Formules', '🍽️', 1, true),
  (3, 'Grillades', '🔥', 3, true),
  (4, 'Plateaux', '🥘', 4, true),
  (5, 'Entrées Froides', '🧆', 5, true),
  (6, 'Desserts', '🍮', 7, true),
  (7, 'Boissons', '🥤', 8, true),
  (13, 'Entrées Chaudes', '🥟', 6, true);

-- Fix sequence après insert avec IDs explicites
SELECT setval('menu_categories_id_seq', (SELECT MAX(id) FROM menu_categories));

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

-- 5. Menu items complet (aligné sur DEMO_ITEMS — 39 items)
INSERT INTO menu_items (id, categorie_id, nom, description, prix, emoji, image_url, ingredients, disponible, actif) VALUES
  -- === SANDWICHS (tous à 6.90€) ===
  (1, 1, 'Shawarma Poulet', 'Émincé de poulet mariné, crudités, sauce maison', 6.90, '🌯', 'img/sandwich-shawarma.jpg', ARRAY['Poulet','Pain libanais'], true, true),
  (2, 1, 'Chich Taouk', 'Brochette de blanc de poulet mariné', 6.90, '🌯', 'img/sandwich-chich-taouk.jpg', ARRAY['Poulet','Pain libanais'], true, true),
  (3, 1, 'Shawarma Boeuf', 'Émincé de boeuf mariné, crudités, sauce maison', 6.90, '🌯', 'img/sandwich-boeuf.jpg', ARRAY['Boeuf','Pain libanais'], true, true),
  (4, 1, 'Falafel', 'Boulette de fèves et pois chiches', 6.90, '🧆', 'img/sandwich-falafel.jpg', ARRAY['Pois chiches','Fèves','Pain libanais'], true, true),
  (5, 1, 'Veggie', 'Chou fleur, aubergine, crudités', 6.90, '🥬', 'img/sandwich-veggie.jpg', ARRAY['Chou fleur','Aubergine','Pain libanais'], true, true),
  (6, 1, 'Foie de Volaille', 'Mariné au citron', 6.90, '🍗', 'img/sandwich-foie-volaille.jpg', ARRAY['Foie de volaille','Pain libanais'], true, true),
  (7, 1, 'Kafta', 'Brochette de boeuf hachée persillée', 6.90, '🍢', 'img/sandwich-kafta.jpg', ARRAY['Boeuf','Pain libanais'], true, true),
  (8, 1, 'Soujouk', 'Saucisses de boeuf épicées', 6.90, '🌭', 'img/sandwich-soujouk.jpg', ARRAY['Boeuf','Pain libanais'], true, true),

  -- === FORMULES ===
  (10, 2, 'Formule 1', 'Sandwich + 2 feuilletés + boisson', 10.90, '1️⃣', NULL, ARRAY[]::text[], true, true),
  (11, 2, 'Formule 2', 'Sandwich + entrée froide + boisson', 11.90, '2️⃣', NULL, ARRAY[]::text[], true, true),
  (12, 2, 'Formule 3', 'Sandwich + dessert + boisson', 11.90, '3️⃣', NULL, ARRAY[]::text[], true, true),
  (13, 2, 'Formule 4', '2 sandwiches au choix + boisson', 14.90, '4️⃣', NULL, ARRAY[]::text[], true, true),
  (14, 2, 'Formule Plat du Jour', 'Plat du jour + boisson', 13.90, '🍽️', 'img/plat-jour.jpg', ARRAY[]::text[], true, true),

  -- === GRILLADES ===
  (20, 3, 'Kafta Méchoui', '2 brochettes boeuf, riz, crudités', 13.00, '🍢', NULL, ARRAY['Boeuf','Riz'], true, true),
  (21, 3, 'Chich Taouk', '2 brochettes poulet, riz, crudités', 13.00, '🍗', NULL, ARRAY['Poulet','Riz'], true, true),
  (22, 3, 'Shawarma Poulet ou Boeuf', 'Émincé mariné grillé à la broche, riz, crudités', 15.00, '🌯', NULL, ARRAY['Poulet','Boeuf','Riz'], true, true),
  (24, 3, 'Grillade Mixte', 'Shawarma poulet, kafta, chich taouk, riz, crudités', 16.00, '🔥', NULL, ARRAY['Poulet','Boeuf','Riz'], true, true),

  -- === PLATEAUX ===
  (30, 4, 'Beyrouth Poulet', 'Houmous, moutabal, taboulé, shawarma poulet, riz', 14.00, '🥘', NULL, ARRAY['Poulet','Riz','Pois chiches','Aubergine','Boulgour'], true, true),
  (31, 4, 'Beyrouth Boeuf', 'Houmous, moutabal, taboulé, shawarma boeuf, riz', 15.00, '🥘', NULL, ARRAY['Boeuf','Riz','Pois chiches','Aubergine','Boulgour'], true, true),
  (32, 4, 'Végétarienne', 'Houmous, moutabal, moussaka, crudités, 3 feuilletés végétariens', 14.00, '🥬', NULL, ARRAY['Pois chiches','Aubergine'], true, true),
  (33, 4, 'Falafel', 'Houmous, moutabal, taboulé, crudités, 3 falafels', 14.00, '🧆', NULL, ARRAY['Pois chiches','Fèves','Aubergine','Boulgour'], true, true),
  (34, 4, 'Liban', 'Houmous, moutabal, chich taouk, riz, crudités, 2 feuilletés végétariens', 16.00, '🇱🇧', NULL, ARRAY['Poulet','Riz','Pois chiches','Aubergine'], true, true),
  (35, 4, 'Byblos', 'Houmous, moutabal, taboulé, 3 feuilletés végétariens, kafta, chich taouk, shawarma poulet, riz', 18.00, '👑', NULL, ARRAY['Poulet','Boeuf','Riz','Pois chiches','Aubergine','Boulgour'], true, true),

  -- === ENTRÉES FROIDES ===
  (40, 5, 'Houmous', 'Purée de pois chiches au tahini, parfumée au citron et à l''huile d''olive', 6.00, '🫘', 'img/houmous.jpg', ARRAY['Pois chiches','Tahini'], true, true),
  (41, 5, 'Moutabal', 'Caviar d''aubergines rôties à la crème de sésame, jus de citron', 6.00, '🍆', 'img/moutabal.jpg', ARRAY['Aubergine','Tahini'], true, true),
  (42, 5, 'Taboulé', 'Salade de persil, tomates, oignons, blé concassé, huile d''olive, citron', 6.00, '🥗', 'img/taboule.jpg', ARRAY['Persil','Boulgour','Tomates','Menthe'], true, true),
  (43, 5, 'Salade du Moine', 'Aubergines grillées, tomates, persil, poivrons, huile d''olive, jus de citron', 6.00, '🥗', NULL, ARRAY['Aubergine','Tomates','Persil'], true, true),
  (44, 5, 'Moussaka', 'Aubergines au four, cuisinées à la sauce tomate, pois chiches', 7.50, '🍲', NULL, ARRAY['Aubergine','Tomates','Pois chiches'], true, true),
  (45, 5, 'Feuilles de Vignes', 'Farcies de riz, huile d''olive, citron', 6.00, '🌿', 'img/feuilles-vigne.jpg', ARRAY['Riz'], true, true),

  -- === ENTRÉES CHAUDES ===
  (70, 13, 'Falafel (pièce)', 'Fèves et pois chiches à la coriandre', 1.50, '🧆', 'img/falafel.jpg', ARRAY['Pois chiches','Fèves'], true, true),
  (71, 13, 'Fattayer', 'Chaussons aux épinards acidulés', 1.50, '🥟', NULL, ARRAY[]::text[], true, true),
  (72, 13, 'Samboussek Fromage', 'Fromage de feta', 1.50, '🥟', 'img/sambousek-fromage.jpg', ARRAY[]::text[], true, true),
  (73, 13, 'Rikakat Fromage', 'Fromage de feta', 2.00, '🧀', 'img/rkakat.jpg', ARRAY[]::text[], true, true),
  (74, 13, 'Samboussek Viande', 'Viande de boeuf haché', 1.50, '🥟', 'img/sambousek-viande.jpg', ARRAY['Boeuf'], true, true),
  (75, 13, 'Kebbé', 'Boulette de blé concassé farcies de viande hachée', 2.50, '🍡', NULL, ARRAY['Boeuf','Boulgour'], true, true),

  -- === DESSERTS ===
  (50, 6, 'Mouhalabieh', 'Flan fleur d''oranger, pistaches (fait maison)', 4.00, '🍮', 'img/mouhalabieh.jpg', ARRAY['Pistaches'], true, true),
  (51, 6, 'Namoura', 'Gâteau de semoule, sirop fleur d''oranger', 4.00, '🍰', 'img/namoura.jpg', ARRAY['Semoule'], true, true),
  (52, 6, 'Baklawas', 'Boîte de 3 pièces', 4.50, '🍯', NULL, ARRAY['Pistaches'], true, true),
  (53, 6, 'Duo Sablés', '2 sablés : pistaches, amandes, noix ou dattes', 5.00, '🍪', NULL, ARRAY[]::text[], true, true),

  -- === BOISSONS (individuelles) ===
  (60, 7, 'Coca-Cola', 'Canette 33cl', 2.00, '🥤', 'img/coca.jpg', ARRAY[]::text[], true, true),
  (61, 7, 'Fanta', 'Canette 33cl', 2.00, '🥤', 'img/fanta.jpg', ARRAY[]::text[], true, true),
  (62, 7, 'Oasis Tropical', 'Canette 33cl', 2.00, '🥤', 'img/oasis.jpg', ARRAY[]::text[], true, true),
  (63, 7, 'Lipton Pêche', 'Canette 33cl', 2.00, '🥤', 'img/lipton.jpg', ARRAY[]::text[], true, true),
  (64, 7, '7Up', 'Canette 33cl', 2.00, '🥤', 'img/7up.jpg', ARRAY[]::text[], true, true),
  (65, 7, 'Coca-Cola Zero', 'Canette 33cl', 2.00, '🥤', 'img/coca-zero.jpg', ARRAY[]::text[], true, true),
  (66, 7, 'Perrier', 'Canette 33cl', 2.00, '🫧', 'img/perrier.jpg', ARRAY[]::text[], true, true),
  (67, 7, 'Ayran', 'Yaourt salé, rafraîchissant', 2.50, '🥛', NULL, ARRAY['Yaourt'], true, true),
  (68, 7, 'Eau Plate', '50cl', 2.00, '💧', 'img/eau.jpg', ARRAY[]::text[], true, true);

-- Fix sequence après insert avec IDs explicites
SELECT setval('menu_items_id_seq', (SELECT MAX(id) FROM menu_items));

-- Vérification
SELECT 'Catégories: ' || count(*) FROM menu_categories
UNION ALL
SELECT 'Items: ' || count(*) FROM menu_items
UNION ALL
SELECT 'Ingrédients: ' || count(*) FROM ingredients;
