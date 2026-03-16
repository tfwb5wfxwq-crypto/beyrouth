# Edenred - Passage en PRODUCTION

## ✅ Statut actuel : SANDBOX (UAT)

- **Auth URL** : https://sso.sbx.edenred.io
- **Payment URL** : https://directpayment.stg.eu.edenred.io/v2
- **MID** : 1418943 (UAT)
- **Test account** : AncelinSimon@yopmail.com / Edenred2026* / SMS: 000000

## 📋 Checklist avant PROD

### 1. Tests UAT à compléter

- [ ] Tester paiement complet (OAuth + capture)
- [ ] Tester remboursement (annulation commande)
- [ ] Tester cas d'erreur (limite dépassée, horaires)
- [ ] Vérifier emails envoyés (confirmation + annulation)
- [ ] Tester sur mobile (Safari iOS + Chrome Android)

### 2. Bugs à fixer avant PROD

- [x] ✅ Callback OAuth : loading infini si code expiré (FIXÉ)
- [x] ✅ Timeout 30s sur callback (FIXÉ)
- [ ] ⚠️ Réactiver CSRF protection (table `oauth_states` causait 503)
- [ ] ⚠️ Restreindre CORS de `*` à `beyrouth.express` uniquement

### 3. Intégration PayGreen à tester d'abord

**Recommandation** : Valider PayGreen en PROD **AVANT** Edenred
- PayGreen = 90% des paiements (CB + Swile + Conecs)
- Edenred = 3-5% des paiements (Ticket Restaurant uniquement)
- Plus simple à gérer en cas de problème

**Critères pour activer Edenred** :
- Minimum 50-100 commandes PayGreen réussies
- Taux d'erreur < 1%
- Clients demandent explicitement Edenred

---

## 🚀 Passage en PRODUCTION

### Étape 1 : Demander credentials PROD

**Email à** : Clément Besson (support-EDPS-FR@edenred.com)

```
Objet : Demande credentials PRODUCTION - A Beyrouth (MID 1205663)

Bonjour Clément,

Les tests UAT sont terminés avec succès pour notre intégration Edenred Payment Services.

Pouvez-vous nous transmettre les credentials PRODUCTION :
- Client ID & Secret (OAuth SSO)
- Client ID & Secret (Payment API)
- Confirmation MID PROD : 1205663

Restaurant : A Beyrouth
SIRET : 83067504700013
URL : https://beyrouth.express

Merci,
Paco
```

### Étape 2 : Configurer credentials dans Supabase

1. Aller sur https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/settings/vault
2. Ajouter/Modifier secrets :
   - `EDENRED_AUTH_CLIENT_ID` : (OAuth Client ID PROD)
   - `EDENRED_AUTH_CLIENT_SECRET` : (OAuth Client Secret PROD)
   - `EDENRED_PAYMENT_CLIENT_ID` : (Payment Client ID PROD)
   - `EDENRED_PAYMENT_CLIENT_SECRET` : (Payment Client Secret PROD)

### Étape 3 : Modifier URLs dans Edge Functions

**Fichiers à modifier** :

1. **`supabase/functions/edenred-initiate-oauth/index.ts`** (lignes 8-9) :
   ```typescript
   // AVANT (UAT)
   const EDENRED_AUTH_URL = 'https://sso.sbx.edenred.io'
   const EDENRED_MID = '1418943'

   // APRÈS (PROD)
   const EDENRED_AUTH_URL = 'https://sso.edenred.io'
   const EDENRED_MID = '1205663'
   ```

2. **`supabase/functions/edenred-oauth-callback/index.ts`** (lignes 6-8) :
   ```typescript
   // AVANT (UAT)
   const EDENRED_AUTH_URL = 'https://sso.sbx.edenred.io/connect/token'
   const EDENRED_PAYMENT_URL = 'https://directpayment.stg.eu.edenred.io/v2/transactions'
   const EDENRED_MID = '1418943'

   // APRÈS (PROD)
   const EDENRED_AUTH_URL = 'https://sso.edenred.io/connect/token'
   const EDENRED_PAYMENT_URL = 'https://directpayment.eu.edenred.io/v2/transactions'
   const EDENRED_MID = '1205663'
   ```

3. **`supabase/functions/edenred-refund/index.ts`** (lignes 6-7) :
   ```typescript
   // AVANT (UAT)
   const EDENRED_PAYMENT_URL = 'https://directpayment.stg.eu.edenred.io/v2'
   const EDENRED_MID = '1418943'

   // APRÈS (PROD)
   const EDENRED_PAYMENT_URL = 'https://directpayment.eu.edenred.io/v2'
   const EDENRED_MID = '1205663'
   ```

### Étape 4 : Déployer Edge Functions

```bash
cd ~/beyrouth
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"

supabase functions deploy edenred-initiate-oauth
supabase functions deploy edenred-oauth-callback
supabase functions deploy edenred-refund
```

### Étape 5 : Test PROD (petit montant)

1. Créer commande de **1-2€** (minimum test)
2. Payer avec **vraie carte Ticket Restaurant**
3. Vérifier capture + email de confirmation
4. Tester annulation + remboursement

### Étape 6 : Monitoring première semaine

- Vérifier logs Edge Functions quotidiennement
- Surveiller taux d'erreur Edenred
- Comparer avec PayGreen (doit être similaire)

---

## 💰 Tarifs PRODUCTION

- **Commission** : 1.50% sur transactions Ticket Restaurant
- **Frais setup** : 0€
- **Frais intégration** : 0€
- **Minimum mensuel** : 0€
- **Paiement** : Hebdomadaire (Lun-Ven → payé semaine suivante)

---

## 📊 Estimation revenus

**Hypothèse** : 100 commandes/mois, panier moyen 15€

| Moyen paiement | % | Transactions/mois | CA mensuel | Commission | Net |
|----------------|---|-------------------|------------|------------|-----|
| CB (PayGreen) | 60% | 60 | 900€ | 2.5% = 22.50€ | 877.50€ |
| Swile (PayGreen) | 20% | 20 | 300€ | 1.5% = 4.50€ | 295.50€ |
| Conecs (PayGreen) | 10% | 10 | 150€ | 1.5% = 2.25€ | 147.75€ |
| **Edenred** | 10% | 10 | 150€ | 1.5% = 2.25€ | 147.75€ |
| **TOTAL** | 100% | 100 | **1500€** | **31.50€** | **1468.50€** |

**Edenred représente ~10% du CA ticket resto** (minoritaire vs Swile/Conecs).

---

## ⚠️ Points d'attention PROD

1. **Limitation horaires** : Lun-Ven 11h30-21h00 uniquement (loi française)
2. **Daily limit** : Vérifier limites cartes clients (souvent 25€/jour)
3. **Reimbursement delays** : 5-7 jours ouvrés (standard Edenred)
4. **Support Edenred** : Lun-Ven business hours uniquement

---

## 📞 Contacts support

- **Commercial** : Clément Besson +33 6 24 47 02 20
- **Support technique** : support-EDPS-FR@edenred.com
- **Dashboard** : https://partners.eu.edenred.io/
