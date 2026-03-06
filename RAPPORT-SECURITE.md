# 🔒 Rapport de Sécurité — Beyrouth Express
**Date:** 6 mars 2026
**Analysé par:** Claude Code
**Scope:** Système pause admin + Menu activé/désactivé

---

## ⚠️ FAILLES CRITIQUES DÉTECTÉES

### 1. 🚨 Pause Admin — CONTOURNABLE (Critique)

**Problème:**
Un client peut commander pendant la pause en modifiant l'heure de retrait côté navigateur.

**Détails techniques:**
- `index.html:1423` : `pickup` récupéré depuis `document.getElementById('pickupTime').value`
- `index.html:1458` : Inséré dans la commande SANS validation serveur
- `create-payment/index.ts` : Edge Function ne valide PAS le créneau choisi

**Scénario d'attaque:**
```javascript
// Paco met pause jusqu'à 15h00
// Client ouvre DevTools et tape :
document.getElementById('pickupTime').value = "Aujourd'hui 12h00"; // PENDANT LA PAUSE
document.getElementById('cartSubmit').click(); // Commande créée !
```

**Impact:**
- ⛔ Client peut retirer plus tôt que prévu
- ⛔ Paco perd le contrôle de la pause
- ⛔ Commandes arrivent même si fermé

---

### 2. 🚨 Menu Désactivé — CONTOURNABLE (Critique)

**Problème:**
Un client peut commander un plat désactivé par Paco en modifiant `menuItems` côté navigateur.

**Détails techniques:**
- `index.html:924` : `addToCart()` vérifie `item.disponible` (frontend uniquement)
- `create-payment/index.ts` : Edge Function ne valide PAS la disponibilité des items

**Scénario d'attaque:**
```javascript
// Paco désactive "Shawarma Poulet" (id: 30)
// Client ouvre DevTools et tape :
menuItems.find(i => i.id === 30).disponible = true;
addToCart(30); // Ajouté au panier !
// Commande créée avec plat désactivé
```

**Impact:**
- ⛔ Paco désactive un plat (rupture stock) → client peut quand même commander
- ⛔ Ingrédients désactivés → contournables aussi
- ⛔ Contrôle menu inefficace

---

## ✅ POINTS FORTS (Frontend)

| Feature | Status | Détails |
|---------|--------|---------|
| **Labels jour cohérents** | ✅ OK | Aujourd'hui/Demain/Lundi affichés correctement partout |
| **Heures arrondies demi-heure** | ✅ OK | 11h30, 12h00, 12h30... (corrigé aujourd'hui) |
| **Realtime pause** | ✅ OK | Pause appliquée sans refresh (lignes 791-798) |
| **UI bloque créneaux pause** | ✅ OK | Créneaux grisés avant `nextSlotAvailableAt` (ligne 2198) |
| **Menu indisponible grisé** | ✅ OK | Badge "Bientôt disponible" + pas de onclick (ligne 861) |
| **addToCart() vérifie dispo** | ✅ OK | Return early si `!item.disponible` (ligne 924) |

**MAIS** : Tout contournable en 30 secondes avec DevTools !

---

## 🛠️ CORRECTIONS RECOMMANDÉES

### Fix #1 : Validation Pause Côté Serveur

**Modifier** : `supabase/functions/create-payment/index.ts`

```typescript
// Après ligne 29 (après validation params)

// NOUVEAU : Valider le créneau choisi
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// Récupérer la pause active
const { data: pauseData } = await supabase
  .from('settings')
  .select('value')
  .eq('key', 'next_slot_available_at')
  .maybeSingle()

if (pauseData?.value) {
  const pauseDate = new Date(pauseData.value)
  const now = new Date()

  // Si pause active et pickup = "asap"
  if (pickup === 'asap' && pauseDate > now) {
    return new Response(
      JSON.stringify({ error: 'Restaurant en pause. Choisissez un autre créneau.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Si pickup est une heure spécifique, parser et valider
  if (pickup !== 'asap') {
    // TODO: Parser "Aujourd'hui 14h30" → Date
    // Vérifier que pickupDate > pauseDate
    // Sinon return 400
  }
}

// Récupérer les horaires du restaurant
// TODO: Vérifier que le créneau est dans les horaires d'ouverture
```

**Alternative plus simple (recommandée) :**
Créer une Edge Function `validate-order` appelée AVANT `create-payment` qui :
1. Vérifie la pause
2. Vérifie les horaires
3. Vérifie la disponibilité des items
4. Retourne OK ou erreur

---

### Fix #2 : Validation Menu Côté Serveur

**Modifier** : `supabase/functions/create-payment/index.ts`

```typescript
// Après ligne 29 (après validation params)

// NOUVEAU : Vérifier disponibilité des items commandés
const itemIds = items.map(i => i.id)
const { data: menuData } = await supabase
  .from('menu_items')
  .select('id, disponible')
  .in('id', itemIds)

const unavailableItems = menuData?.filter(i => !i.disponible) || []
if (unavailableItems.length > 0) {
  return new Response(
    JSON.stringify({
      error: `Certains plats ne sont plus disponibles. Actualisez la page.`,
      unavailable_ids: unavailableItems.map(i => i.id)
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// TODO aussi : vérifier ingrédients
```

---

## 📋 TESTS EDGE CASES

| Scénario | Résultat Actuel | Résultat Attendu |
|----------|-----------------|-------------------|
| Pause activée PENDANT commande en cours | ❌ Commande créée | ⚠️ Alerte + refresh |
| Plat désactivé PENDANT dans panier | ❌ Commande créée | ⚠️ Retrait auto panier |
| Heure choisie + pause admin après | ❌ Commande créée | ✅ Bloquée si < pause |
| Modifier `pickupTime` dans DevTools | ❌ Bypass possible | ✅ Validation serveur |
| Modifier `item.disponible` DevTools | ❌ Bypass possible | ✅ Validation serveur |

---

## 🎯 PRIORITÉS

1. **URGENT** : Fix #1 (Pause) - Impact business direct (clients arrivent trop tôt)
2. **URGENT** : Fix #2 (Menu) - Impact stock (commandes impossibles à honorer)
3. **Important** : Tests edge cases automatisés
4. **Nice to have** : Logs des tentatives de bypass (honeypot)

---

## 📊 RÉSUMÉ EXÉCUTIF

**Status global** : 🟠 Sécurité Frontend OK, Backend VULNÉRABLE

**Risques** :
- 🔴 Client peut bypass la pause (modif DevTools)
- 🔴 Client peut commander des plats désactivés (modif DevTools)
- 🟢 UI/UX respecte bien les règles (affichage cohérent)
- 🟢 Realtime fonctionne (pause + menu sync)

**Recommandation** :
Implémenter les validations côté serveur AVANT mise en production. Pour l'instant, le système est **fonctionnel mais non sécurisé** face à un client malveillant.
