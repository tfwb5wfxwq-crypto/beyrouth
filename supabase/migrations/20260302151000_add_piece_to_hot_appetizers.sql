-- Ajouter (pièce) aux entrées chaudes

UPDATE menu_items SET nom = 'Fattayer (pièce)' WHERE nom = 'Fattayer' AND categorie_id = 13;
UPDATE menu_items SET nom = 'Kebbé (pièce)' WHERE nom = 'Kebbé' AND categorie_id = 13;
UPDATE menu_items SET nom = 'Rikakat Fromage (pièce)' WHERE nom = 'Rikakat Fromage' AND categorie_id = 13;
UPDATE menu_items SET nom = 'Samboussek Fromage (pièce)' WHERE nom = 'Samboussek Fromage' AND categorie_id = 13;
UPDATE menu_items SET nom = 'Samboussek Viande (pièce)' WHERE nom = 'Samboussek Viande' AND categorie_id = 13;

-- Vérifier le résultat
SELECT nom FROM menu_items WHERE categorie_id = 13 ORDER BY nom;
