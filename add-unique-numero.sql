-- Ajouter contrainte UNIQUE sur la colonne numero
-- Empêche les doublons de numéros de commande
-- Format nouveau numéro : 4 chiffres + 2 lettres (ex: 4728KP)
-- 6,760,000 combinaisons possibles

ALTER TABLE orders
ADD CONSTRAINT unique_numero UNIQUE (numero);
