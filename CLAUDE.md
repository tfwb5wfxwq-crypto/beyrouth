# Beyrouth Express

## Projet
Site click & collect pour le restaurant libanais "A Beyrouth" à La Défense.
- **Site** : beyrouth.express
- **Restaurant** : A Beyrouth
- **Adresse** : Sortie 4 du métro, 1 Esplanade du Général de Gaulle, 92800 Puteaux (La Défense)
- **Propriétaire** : Paco
- **GitHub** : tfwb5wfxwq-crypto/beyrouth

## Supabase
- **Project ref** : xbuftfwcyontgqbbrrjt
- **URL** : https://xbuftfwcyontgqbbrrjt.supabase.co
- **Anon Key** : (dans index.html, publique)
- **Service Role Key + secrets** : voir `.env` (gitignored)
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

## GitHub
- **Repo** : tfwb5wfxwq-crypto/beyrouth
- **Compte GitHub** : `tfwb5wfxwq-crypto` (switch avant push, puis reswitch sur `iarmy-dev`)
- **Commandes** : `gh auth switch --user tfwb5wfxwq-crypto` → push → `gh auth switch --user iarmy-dev`

## Fichiers
- `index.html` : page client (menu + panier + commande) - UI Uber Eats-like
- `commande.html` : suivi commande temps réel
- `admin/index.html` : dashboard Paco (tablette, PWA)
- `admin/manifest.json` : PWA manifest
- `supabase-schema.sql` : schéma BDD complet à exécuter dans Supabase SQL Editor
- `seed-menu.sql` : script seed menu complet (alternative SQL Editor)
- `img/` : images optimisées des plats (JPG 600px, sans watermark Gemini)
