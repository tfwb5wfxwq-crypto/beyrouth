-- Correction des images incorrectes

-- Ayran (avait houmous.jpg au lieu de ayran.jpg)
UPDATE menu_items SET image_url = 'img/ayran.jpg' WHERE nom = 'Ayran';

-- Byblos (avait baklawas.jpg au lieu de byblos.jpg)
UPDATE menu_items SET image_url = 'img/byblos.jpg' WHERE nom = 'Byblos';

-- Liban (avait namoura.jpg au lieu de liban.jpg)
UPDATE menu_items SET image_url = 'img/liban.jpg' WHERE nom = 'Liban';

-- Assortiment Baklawas 250g (avait rkakat.jpg)
UPDATE menu_items SET image_url = 'img/baklawas-250g.jpg' WHERE nom = 'Assortiment Baklawas 250g';

-- Assortiment Baklawas 500g (avait sambousek-viande.jpg)
UPDATE menu_items SET image_url = 'img/baklawas-500g.jpg' WHERE nom = 'Assortiment Baklawas 500g';

-- Pain Libanais (avait kebbe.jpg)
UPDATE menu_items SET image_url = 'img/pain-libanais.jpg' WHERE nom = 'Pain Libanais';

-- Plateau Falafel (si existe)
UPDATE menu_items SET image_url = 'img/plateau-falafel.jpg' WHERE nom LIKE '%Plateau%Falafel%';

-- Plateau Végétarien (si existe)
UPDATE menu_items SET image_url = 'img/plateau-vegetarien.jpg' WHERE nom LIKE '%Plateau%Végétarien%';

-- Grillades (différencier des sandwiches)
UPDATE menu_items SET image_url = 'img/chich-taouk.jpg' WHERE nom = 'Chich Taouk' AND categorie_id != 1;
UPDATE menu_items SET image_url = 'img/shawarma-poulet.jpg' WHERE nom = 'Shawarma Poulet' AND categorie_id != 1;
UPDATE menu_items SET image_url = 'img/beyrouth-poulet.jpg' WHERE nom LIKE '%Beyrouth%Poulet%';
UPDATE menu_items SET image_url = 'img/beyrouth-boeuf.jpg' WHERE nom LIKE '%Beyrouth%Boeuf%';

-- Vérifier le résultat
SELECT nom, image_url FROM menu_items WHERE nom IN ('Ayran', 'Byblos', 'Liban', 'Assortiment Baklawas 250g', 'Assortiment Baklawas 500g', 'Pain Libanais') ORDER BY nom;
