-- Corriger l'image du plateau Falafel (actuellement a l'image du sandwich)

UPDATE menu_items
SET image_url = 'img/plateau-falafel.jpg'
WHERE nom = 'Falafel' AND categorie_id = 4;

-- Vérifier
SELECT nom, image_url FROM menu_items WHERE categorie_id = 4 ORDER BY nom;
