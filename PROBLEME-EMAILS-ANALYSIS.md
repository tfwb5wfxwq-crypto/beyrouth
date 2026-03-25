# Problème Emails Beyrouth Express - Analyse Complète

**Date:** 25 mars 2026 23:30
**Commande concernée:** 8859 VT
**Email client:** ludovikh@gmail.com

---

## 🔍 DIAGNOSTIC

### Symptômes
- Commande acceptée dans l'admin (statut = "acceptee")
- Email de confirmation PAS envoyé automatiquement
- `confirmation_email_sent_at` était NULL dans la DB

### Tests effectués

✅ **Edge Function send-order-confirmation fonctionne**
```bash
curl -X POST 'https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/send-order-confirmation' \
  -H 'Content-Type: application/json' \
  -d '{"orderId": 211}'

# Résultat: {"success":true,"emailId":"48bc68ca-1ab3-4dcf-b124-678143833c77"}
```

✅ **API Resend fonctionne**
```bash
curl -X POST https://api.resend.com/emails \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' \
  -d '{"from":"A Beyrouth <commande@beyrouth.express>","to":"ludovikh@gmail.com","subject":"Test","html":"<p>Test</p>"}'

# Résultat: {"id":"9d6dc264-b3c8-4d07-8b15-664c822b9052"}
```

✅ **RESEND_API_KEY configurée dans Supabase Secrets**

✅ **Domaine beyrouth.express verified** (DKIM, SPF, MX OK)

### Cause racine identifiée

**Le code de l'admin tente d'envoyer l'email mais échoue silencieusement.**

Code dans `gestion-be-2026/index.html` (ligne 2100) :

```javascript
if (newStatus === 'acceptee') {
  try {
    const { data, error } = await sb.functions.invoke('send-order-confirmation', {
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: { orderId: orderId }
    });
    if (error) throw error;
    console.log('✅ Email de confirmation envoyé:', data);
    showToast('✅ Email de confirmation envoyé à ' + (order.client_email || 'client'), 'success');
  } catch (err) {
    console.error('❌ Erreur envoi email:', err);
    showToast('⚠️ Commande acceptée mais email non envoyé', 'warning');
  }
}
```

**Problèmes potentiels :**

1. **adminToken invalide ou expiré** → Appel Edge Function échoue
2. **Erreur réseau** → Timeout ou connexion perdue
3. **CORS** → Bloqué par le navigateur (peu probable car même origin)
4. **Toast d'erreur passe trop vite** → Ludovik ne le voit pas

---

## 🛠️ SOLUTIONS

### Solution 1 : Rendre l'envoi d'email AUTOMATIQUE côté serveur (RECOMMANDÉ)

**Créer un Database Trigger Postgres qui envoie l'email automatiquement.**

Avantages :
- ✅ Fiable (pas dépendant du client)
- ✅ Impossible à manquer
- ✅ Fonctionne même si l'admin perd la connexion

Migration SQL :

```sql
-- Créer fonction trigger pour envoyer email automatiquement
CREATE OR REPLACE FUNCTION trigger_send_confirmation_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Si statut passe à "acceptee" et email pas encore envoyé
  IF NEW.statut = 'acceptee' AND OLD.statut != 'acceptee' AND NEW.confirmation_email_sent_at IS NULL THEN
    -- Appeler Edge Function via pg_net (extension Supabase)
    PERFORM
      net.http_post(
        url := 'https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/send-order-confirmation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('request.jwt.claim.sub', true)
        ),
        body := jsonb_build_object('orderId', NEW.id)
      );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer trigger
CREATE TRIGGER on_order_accepted
  AFTER UPDATE OF statut ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_confirmation_email();
```

⚠️ **Note:** Nécessite l'extension `pg_net` (déjà installée sur Supabase)

---

### Solution 2 : Améliorer le retry et la visibilité des erreurs dans l'admin

**Modifier `gestion-be-2026/index.html` :**

```javascript
if (newStatus === 'acceptee') {
  haptic.trigger('success');

  // Retry logic avec meilleure visibilité
  let emailSent = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await sb.functions.invoke('send-order-confirmation', {
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { orderId: orderId }
      });

      if (error) throw error;

      console.log('✅ Email de confirmation envoyé:', data);
      showToast('✅ Email de confirmation envoyé à ' + (order.client_email || 'client'), 'success', 5000);
      emailSent = true;
      break; // Succès, sortir de la boucle

    } catch (err) {
      console.error(`❌ Tentative ${attempt}/3 d'envoi email échouée:`, err);

      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Attendre 1s, 2s, 3s
      } else {
        // Échec après 3 tentatives
        showToast('🚨 EMAIL NON ENVOYÉ ! Cliquer sur "Relancer" pour réessayer', 'error', 10000);

        // Marquer visuellement la commande en orange
        const card = document.getElementById(`order-${orderId}`);
        if (card) {
          card.style.borderLeft = '4px solid orange';
          card.style.background = 'rgba(255,165,0,0.05)';
        }
      }
    }
  }
}
```

Avantages :
- ✅ Retry automatique 3 fois
- ✅ Toast d'erreur reste affiché 10 secondes (au lieu de 3)
- ✅ Carte de commande visuellement marquée en orange si email échoue

---

### Solution 3 : Ajouter un bouton "Renvoyer email" dans l'admin

**Ajouter un bouton dans les actions de commande :**

```javascript
// Dans la fonction generateActionButtons()
if (statut === 'acceptee' && !order.confirmation_email_sent_at) {
  buttons.push(`
    <button onclick="resendConfirmationEmail(${orderId})"
            style="background:#ff9800;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer">
      📧 Renvoyer email
    </button>
  `);
}
```

```javascript
async function resendConfirmationEmail(orderId) {
  showToast('📧 Envoi en cours...', 'info');

  try {
    const adminToken = localStorage.getItem('adminToken');
    const { data, error } = await sb.functions.invoke('send-order-confirmation', {
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { orderId }
    });

    if (error) throw error;

    showToast('✅ Email envoyé avec succès !', 'success', 5000);
    debouncedRenderOrders(); // Rafraîchir l'affichage

  } catch (err) {
    console.error('Erreur renvoi email:', err);
    showToast('❌ Erreur lors de l\'envoi de l\'email', 'error', 5000);
  }
}
```

---

## ✅ RECOMMANDATION FINALE

**Combiner les 3 solutions :**

1. **Implémenter le Database Trigger** (Solution 1) → Fiabilité maximale
2. **Garder l'appel client-side** avec retry (Solution 2) → Double sécurité
3. **Ajouter bouton manuel** (Solution 3) → Fallback si les deux échouent

Ainsi, les emails seront TOUJOURS envoyés, peu importe ce qui se passe côté client.

---

## 🔧 ACTIONS À FAIRE

1. Exécuter la migration SQL pour créer le trigger
2. Modifier `gestion-be-2026/index.html` avec retry logic
3. Ajouter bouton "Renvoyer email"
4. Tester avec une commande test

---

## 📊 STATISTIQUES ACTUELLES

**Commandes sans email envoyé :**

```sql
SELECT COUNT(*) FROM orders
WHERE statut IN ('acceptee','en_preparation','prete','recuperee')
  AND confirmation_email_sent_at IS NULL;
```

**Action corrective pour commandes existantes :**

Si des commandes acceptées n'ont jamais reçu d'email, exécuter :

```sql
-- Lister les commandes concernées
SELECT id, numero, client_email, statut, created_at
FROM orders
WHERE statut IN ('acceptee','en_preparation','prete','recuperee')
  AND confirmation_email_sent_at IS NULL
ORDER BY created_at DESC;
```

Puis renvoyer manuellement les emails via curl ou l'admin.

---

**Fait par Claude Code - 25 mars 2026**
