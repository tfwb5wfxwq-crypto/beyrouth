-- Utiliser les meilleures photos de baklawas (baklaawa avec 3 'a') et duo sablé

UPDATE menu_items SET image_url = 'img/baklaawa.jpg' WHERE nom = 'Baklawas';
UPDATE menu_items SET image_url = 'img/baklaawa-250g.jpg' WHERE nom = 'Assortiment Baklawas 250g';
UPDATE menu_items SET image_url = 'img/baklaawa-500g.jpg' WHERE nom = 'Assortiment Baklawas 500g';
UPDATE menu_items SET image_url = 'img/duo-sable.jpg' WHERE nom = 'Duo Sablés';

-- Vérifier
SELECT nom, image_url FROM menu_items WHERE nom IN ('Baklawas', 'Assortiment Baklawas 250g', 'Assortiment Baklawas 500g', 'Duo Sablés');
