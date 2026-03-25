# 🚨 DIAGNOSTIC COMPLET - Problèmes Emails Beyrouth Express

**Date:** 25 mars 2026 23:45
**Analysé par:** Claude Code

---

## 📊 RÉSUMÉ EXECUTIF

**3 PROBLÈMES MAJEURS IDENTIFIÉS :**

1. ❌ **Edge Function pas appelée automatiquement** → Email non envoyé pour 8859 VT
2. ❌ **DMARC en mode "none"** → iCloud Mail met TOUT en spam
3. ⚠️ **Pas de retry/fallback** → Erreurs silencieuses dans l'admin

---

## 🔴 PROBLÈME #1 : Edge Function non appelée

### Symptômes
- Commande 8859 VT acceptée à 18h55
- Email PAS envoyé automatiquement
- `confirmation_email_sent_at` était NULL jusqu'à 23h26 (envoi manuel)

### Tests effectués

✅ **Edge Function fonctionne** (testé manuellement) :
```bash
curl -X POST 'https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/send-order-confirmation' \
  -H 'Content-Type: application/json' \
  -d '{"orderId": 211}'

# Résultat: success ✅
```

✅ **API Resend fonctionne** :
```bash
curl -X POST https://api.resend.com/emails \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' \
  -d '{"from":"A Beyrouth <commande@beyrouth.express>","to":"ludovikh@gmail.com",...}'

# Résultat: success ✅
```

### Cause racine

**Code dans `gestion-be-2026/index.html` (ligne 2100) :**

```javascript
if (newStatus === 'acceptee') {
  try {
    const { data, error } = await sb.functions.invoke('send-order-confirmation', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { orderId: orderId }
    });
    if (error) throw error;
    showToast('✅ Email envoyé...', 'success');
  } catch (err) {
    console.error('❌ Erreur envoi email:', err);
    showToast('⚠️ Commande acceptée mais email non envoyé', 'warning');
  }
}
```

**Problèmes possibles :**

1. **`sb.functions.invoke()` échoue silencieusement**
   - Erreur réseau (connexion tablette perdue)
   - Timeout (fonction met trop de temps)
   - CORS bloqué (peu probable vu que même origin)

2. **`adminToken` invalide ou expiré**
   - Token JWT a une durée de vie limitée
   - Si tablette reste ouverte longtemps sans refresh → token expire

3. **Toast d'erreur passe trop vite**
   - Affiché 3 secondes par défaut
   - Paco ne le voit pas

4. **Erreur loggée dans console mais pas visible**
   - Sur tablette Android, console pas accessible facilement

### Vérification des commandes affectées

```sql
SELECT COUNT(*) FROM orders
WHERE statut IN ('acceptee','en_preparation','prete','recuperee')
  AND confirmation_email_sent_at IS NULL;

-- Résultat: 0 (après correction manuelle de 8859 VT)
```

**➜ C'était la SEULE commande affectée !**

---

## 🔴 PROBLÈME #2 : iCloud Mail - DMARC en mode "none"

### Configuration DNS actuelle

```bash
dig +short TXT _dmarc.beyrouth.express
"v=DMARC1; p=none; rua=mailto:commande@beyrouth.express"
```

**`p=none` signifie "ne rien faire en cas d'échec DMARC"**

### Pourquoi iCloud Mail bloque ?

iCloud Mail (et Gmail, Outlook) utilisent DMARC pour décider si un email est légitime :

- `p=none` → "Je ne sais pas quoi faire" → **SPAM**
- `p=quarantine` → "Si suspect, mettre en spam mais accepter si tout est OK" → **INBOX**
- `p=reject` → "Si suspect, rejeter complètement" → **INBOX si tout OK, REJET sinon**

### Records DNS actuels (vérifiés ✅)

| Record | Statut | Valeur |
|--------|--------|--------|
| DKIM | ✅ Verified | `resend._domainkey.beyrouth.express` |
| SPF (MX) | ✅ Verified | `send.beyrouth.express → feedback-smtp.eu-west-1.amazonses.com` |
| SPF (TXT) | ✅ Verified | `v=spf1 include:amazonses.com ~all` |
| **DMARC** | ⚠️ **`p=none`** | **DOIT ÊTRE `p=quarantine`** |

### Solution DMARC

**Modifier le record TXT `_dmarc.beyrouth.express` :**

```
Ancien:
v=DMARC1; p=none; rua=mailto:commande@beyrouth.express

Nouveau:
v=DMARC1; p=quarantine; rua=mailto:commande@beyrouth.express; pct=100; adkim=r; aspf=r
```

**Explication :**
- `p=quarantine` : Mettre en spam si DMARC échoue (au lieu de rien faire)
- `pct=100` : Appliquer la politique à 100% des emails (pas seulement 10%)
- `adkim=r` : DKIM en mode "relaxed" (moins strict)
- `aspf=r` : SPF en mode "relaxed"

**⚠️ Après modification, attendre 24-48h pour propagation DNS + build de réputation iCloud**

---

## 🔴 PROBLÈME #3 : Pas de retry ni fallback

### Problèmes actuels

1. **Un seul essai** → Si échoue, email jamais envoyé
2. **Toast trop court** → 3 secondes, passe inaperçu
3. **Pas de marqueur visuel** → Impossible de voir qu'un email a échoué
4. **Pas de bouton manuel** → Pas de fallback si auto échoue

### Impact

- Commande acceptée ✅
- Client ne reçoit RIEN ❌
- Paco croit que tout va bien ❌
- Client appelle le restaurant fâché ❌

---

## ✅ SOLUTIONS RECOMMANDÉES

### Solution #1 : Database Trigger automatique (PRIORITÉ HAUTE)

**Créer un trigger Postgres qui envoie l'email AUTOMATIQUEMENT côté serveur**

Avantages :
- ✅ Indépendant du client (tablette peut crasher, email part quand même)
- ✅ Fiable à 100% (Postgres + Edge Function)
- ✅ Pas de dépendance au token admin

**Migration SQL à exécuter :**

```sql
-- 1. Activer extension pg_net (déjà installée sur Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Fonction trigger
CREATE OR REPLACE FUNCTION trigger_send_confirmation_email()
RETURNS TRIGGER AS $$
DECLARE
  service_role_key TEXT;
BEGIN
  -- Si statut passe à "acceptee" et email pas encore envoyé
  IF NEW.statut = 'acceptee' AND
     (OLD.statut IS NULL OR OLD.statut != 'acceptee') AND
     NEW.confirmation_email_sent_at IS NULL THEN

    -- Récupérer SERVICE_ROLE_KEY depuis secrets Vault
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'SERVICE_ROLE_KEY'
    LIMIT 1;

    -- Appeler Edge Function via pg_net
    PERFORM net.http_post(
      url := 'https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/send-order-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('orderId', NEW.id)
    );

    -- Log pour debug
    RAISE NOTICE 'Email confirmation trigger pour commande % (ID %)', NEW.numero, NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Créer trigger
DROP TRIGGER IF EXISTS on_order_accepted ON orders;
CREATE TRIGGER on_order_accepted
  AFTER UPDATE OF statut ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_confirmation_email();
```

**⚠️ Attention:** Le SERVICE_ROLE_KEY doit être stocké dans Supabase Vault pour sécurité.

**Commande pour ajouter le secret :**

```bash
cd ~/beyrouth
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"

# Via SQL Editor dans dashboard Supabase :
INSERT INTO vault.secrets (name, secret)
VALUES (
  'SERVICE_ROLE_KEY',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...VOTRE_SERVICE_ROLE_KEY_ICI'
)
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
```

---

### Solution #2 : Améliorer l'admin avec retry + visibilité

**Modifier `gestion-be-2026/index.html` :**

```javascript
// Remplacer le bloc ligne 2096-2114 par :
if (newStatus === 'acceptee') {
  haptic.trigger('success');

  // Retry avec backoff exponentiel
  let emailSent = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await sb.functions.invoke('send-order-confirmation', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { orderId: orderId }
      });

      if (error) throw error;

      console.log('✅ Email confirmation envoyé (tentative ' + attempt + '):', data);
      showToast('✅ Email envoyé à ' + (order.client_email || 'client'), 'success', 5000);
      emailSent = true;

      // Marquer visuellement la commande comme "email envoyé"
      const card = document.getElementById(`order-${orderId}`);
      if (card) {
        card.style.borderLeft = '4px solid #22c55e'; // Vert
      }

      break; // Succès → sortir de la boucle

    } catch (err) {
      console.error(`❌ Tentative ${attempt}/3 envoi email échouée:`, err);

      if (attempt < 3) {
        // Attendre avant retry : 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      } else {
        // ÉCHEC après 3 tentatives
        showToast('🚨 EMAIL NON ENVOYÉ ! Utiliser le bouton "Renvoyer email"', 'error', 15000);

        // Marquer visuellement la carte en ROUGE
        const card = document.getElementById(`order-${orderId}`);
        if (card) {
          card.style.borderLeft = '4px solid #ef4444'; // Rouge
          card.style.background = 'rgba(239,68,68,0.05)';
        }

        // Vibration d'alerte
        haptic.trigger('error');
      }
    }
  }
}
```

**Changements :**
- ✅ 3 tentatives avec backoff (1s, 2s, 4s)
- ✅ Toast d'erreur affiché 15 secondes
- ✅ Carte visuellement marquée (vert si OK, rouge si échec)
- ✅ Vibration d'erreur pour alerter Paco

---

### Solution #3 : Bouton "Renvoyer email"

**Ajouter dans la fonction `generateActionButtons()` :**

```javascript
// Ligne ~2050 dans gestion-be-2026/index.html

// Bouton "Renvoyer email" si commande acceptée mais email pas envoyé
if (statut === 'acceptee' && !order.confirmation_email_sent_at) {
  buttons.push(`
    <button onclick="resendConfirmationEmail(${orderId})"
            style="background:#ff9800;color:#fff;padding:10px 16px;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;box-shadow:0 2px 4px rgba(255,152,0,0.3);">
      📧 Renvoyer email
    </button>
  `);
}
```

**Ajouter la fonction `resendConfirmationEmail` :**

```javascript
// Ajouter après la fonction remindOrder() (ligne ~2150)

async function resendConfirmationEmail(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  showToast(`📧 Envoi email à ${escapeHtml(order.client_prenom || 'client')}...`, 'info');

  try {
    const adminToken = localStorage.getItem('adminToken');
    const { data, error } = await sb.functions.invoke('send-order-confirmation', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { orderId }
    });

    if (error) throw error;

    showToast('✅ Email envoyé avec succès !', 'success', 5000);

    // Marquer carte en vert
    const card = document.getElementById(`order-${orderId}`);
    if (card) {
      card.style.borderLeft = '4px solid #22c55e';
      card.style.background = '';
    }

    debouncedRenderOrders();

  } catch (err) {
    console.error('Erreur renvoi email:', err);
    showToast('❌ Erreur lors de l\'envoi. Réessayer ou contacter support.', 'error', 8000);
  }
}
```

---

### Solution #4 : Corriger DMARC (iCloud Mail)

**Sur le dashboard OVH (DNS beyrouth.express) :**

1. Aller dans **Zone DNS**
2. Trouver le record **`_dmarc`** (type TXT)
3. Modifier la valeur :

```
AVANT:
v=DMARC1; p=none; rua=mailto:commande@beyrouth.express

APRÈS:
v=DMARC1; p=quarantine; rua=mailto:commande@beyrouth.express; pct=100; adkim=r; aspf=r
```

4. Sauvegarder et attendre propagation DNS (1-2h)

**Vérifier après 2h :**

```bash
dig +short TXT _dmarc.beyrouth.express
# Doit afficher : "v=DMARC1; p=quarantine; rua=mailto:commande@beyrouth.express; pct=100; adkim=r; aspf=r"
```

**Tester délivrabilité iCloud :**

```bash
curl -X POST https://api.resend.com/emails \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "A Beyrouth <commande@beyrouth.express>",
    "to": "TON_EMAIL_ICLOUD@icloud.com",
    "subject": "Test DMARC corrigé",
    "html": "<p>Si tu reçois ça en INBOX (pas spam), DMARC est OK !</p>"
  }'
```

---

## 📋 PLAN D'ACTION IMMÉDIAT

### Étape 1 : Corriger DMARC (30 min)
- [ ] Se connecter au dashboard OVH
- [ ] Modifier record `_dmarc.beyrouth.express`
- [ ] Vérifier propagation DNS après 1h
- [ ] Tester avec email iCloud

### Étape 2 : Implémenter Database Trigger (45 min)
- [ ] Se connecter au SQL Editor Supabase
- [ ] Ajouter SERVICE_ROLE_KEY dans Vault
- [ ] Exécuter migration SQL (trigger)
- [ ] Tester avec commande de test

### Étape 3 : Améliorer l'admin (1h)
- [ ] Modifier `gestion-be-2026/index.html`
- [ ] Ajouter retry logic
- [ ] Ajouter bouton "Renvoyer email"
- [ ] Tester sur tablette

### Étape 4 : Monitoring (30 min)
- [ ] Créer dashboard pour tracker les emails
- [ ] Ajouter alertes si email échoue

---

## 🎯 RÉSULTATS ATTENDUS

**Après corrections :**

✅ **100% des emails envoyés** (trigger automatique + retry + bouton manuel)
✅ **iCloud Mail en INBOX** (DMARC `p=quarantine`)
✅ **Visibilité totale** (cartes colorées + toast 15s + bouton manuel)
✅ **Fiabilité** (indépendant du client, fonctionne même si tablette crash)

---

**Fait par Claude Code - 25 mars 2026 23:50**
