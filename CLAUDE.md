# Beyrouth Express

## Projet
Site click & collect pour le restaurant libanais "A Beyrouth" à La Défense.
- **Site** : beyrouth.express
- **Restaurant** : A Beyrouth
- **Adresse** : Sortie 4 du métro, 1 Esplanade du Général de Gaulle, 92800 Puteaux (La Défense)
- **Propriétaire** : Paco
- **GitHub** : tfwb5wfxwq-crypto/beyrouth

## Supabase
- **URL** : https://xbuftfwcyontgqbbrrjt.supabase.co
- **Anon Key** : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhidWZ0ZndjeW9udGdxYmJycmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2Njg1NzksImV4cCI6MjA4NjI0NDU3OX0.ROkSccADlpLsWMgqyiX_xNaFdJNR8P4R-LJCnZV2Gzg
- **Schema** : voir supabase-schema.sql

## Tables Supabase
- `clients` : base de données client (email, prénom, tel, stats)
- `menu_categories` : catégories du menu
- `menu_items` : plats avec prix et ingrédients[]
- `ingredients` : toggle disponibilité temps réel
- `orders` : commandes (statut: payee → acceptee → en_preparation → prete → recuperee)
- `order_items` : détail commandes pour analytics

## Paiement
- PayGreen LunchKit (CB + cartes restaurant) — à intégrer
- CNTR approval nécessaire pour cartes restaurant en ligne

## Stack
- HTML/CSS/JS vanilla (pas de framework)
- Hébergé sur GitHub Pages
- Supabase pour BDD + Realtime + Auth

## Fichiers
- `index.html` : page client (menu + panier + commande)
- `commande.html` : suivi commande temps réel
- `admin/index.html` : dashboard Paco (tablette, PWA)
- `admin/manifest.json` : PWA manifest
- `supabase-schema.sql` : schéma BDD complet à exécuter dans Supabase SQL Editor
