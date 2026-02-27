# Beyrouth Express

## ⚠️ ARCHITECTURE CRITIQUE - LIRE EN PREMIER

**SOURCE DES DONNÉES :**
- ❌ Le site NE CHARGE PAS depuis `DEMO_ITEMS` dans index.html
- ✅ Le site CHARGE DEPUIS SUPABASE (table `menu_items`)
- Le code `DEMO_ITEMS` sert uniquement de fallback si Supabase est down

**POUR MODIFIER LE MENU (PRIX, IMAGES, DESCRIPTIONS) :**
1. Aller sur https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt
2. SQL Editor → Exécuter UPDATE sur `menu_items`
3. Les changements sont INSTANTANÉS (pas besoin de rebuild)

**POUR AJOUTER UNE IMAGE À UN PLAT :**
```sql
UPDATE menu_items SET image_url = 'img/nom-image.jpg' WHERE id = XX;
```

**CACHE :**
- GitHub Pages : peut prendre 2-3 min pour déployer les images
- Cloudflare : purger sur dashboard (Caching → Purge Everything)
- Navigateur : Cmd+Shift+R pour hard refresh

---

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

## Paiement PayGreen ✅ CONFIGURÉ
- **Service** : PayGreen LunchKit (CB + cartes restaurant)
- **Clé Publique** : `pk_e6337053f1f84f39a5b76f2e1035e161` (frontend, dans index.html)
- **Clé Secrète** : `sk_0564063e4ef04dbf93f588e7967e3e61` (backend, dans Supabase secrets)
- **Shop ID** : `sh_55f9f298d8ce478db7b87117ec86ce11`
- **Domaine autorisé** : beyrouth.express
- **Edge Functions** :
  - `create-payment` : Crée session de paiement Paygreen (appel sécurisé avec clé secrète)
  - `paygreen-webhook` : Reçoit confirmations Paygreen et met à jour `orders.statut`
- **Flow** : Commande pending → paiement Paygreen → webhook → statut "payee"
- **Déploiement** : Voir `PAYGREEN-SETUP.md` pour instructions complètes
- **TODO** : Email de confirmation post-paiement (Resend/SendGrid)

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
