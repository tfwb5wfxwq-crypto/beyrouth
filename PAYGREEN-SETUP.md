# Configuration Paygreen — Beyrouth Express

## Clés Paygreen

- **Clé Publique** : `pk_e6337053f1f84f39a5b76f2e1035e161`
- **Clé Secrète** : `sk_0564063e4ef04dbf93f588e7967e3e61`
- **Shop ID** : `sh_55f9f298d8ce478db7b87117ec86ce11`

## Étapes de déploiement

### 1. Mettre à jour le schéma Supabase

Aller sur https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/editor

SQL Editor → New Query → Copier/coller le contenu de `supabase/migrations/add-paygreen-columns.sql`

Exécuter (bouton Run).

### 2. Déployer les Edge Functions

#### Installer Supabase CLI

```bash
brew install supabase/tap/supabase
supabase login
```

#### Lier le projet

```bash
cd ~/beyrouth
supabase link --project-ref xbuftfwcyontgqbbrrjt
```

#### Configurer les secrets

```bash
# Clé secrète Paygreen (JAMAIS dans le code)
supabase secrets set PAYGREEN_SECRET_KEY=sk_0564063e4ef04dbf93f588e7967e3e61

# Shop ID
supabase secrets set PAYGREEN_SHOP_ID=sh_55f9f298d8ce478db7b87117ec86ce11
```

#### Déployer les fonctions

```bash
# Déployer create-payment
supabase functions deploy create-payment

# Déployer paygreen-webhook
supabase functions deploy paygreen-webhook
```

### 3. Configurer le webhook Paygreen

Aller sur le dashboard Paygreen → Paramètres → Webhooks

Ajouter une URL de notification :
```
https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/paygreen-webhook
```

Événements à écouter :
- `transaction.successed`
- `transaction.refused`
- `transaction.cancelled`
- `transaction.refunded`

### 4. Push le code sur GitHub

```bash
cd ~/beyrouth
gh auth switch --user tfwb5wfxwq-crypto

git add .
git commit -m "Intégration Paygreen (paiement CB + cartes restaurant)

- SDK Paygreen dans index.html
- Edge Functions : create-payment + webhook
- Migration SQL : colonnes paygreen_*
- Flow : commande pending → paiement → statut payee"

git push origin main

gh auth switch --user iarmy-dev
```

### 5. Tester

1. Aller sur https://beyrouth.express
2. Ajouter des plats au panier
3. Remplir les infos client
4. Cliquer "Passer la commande"
5. → Redirection vers page de paiement Paygreen
6. Payer avec carte test (voir docs Paygreen)
7. → Retour sur commande.html avec statut "payee"

## Cartes de test Paygreen

### Carte de test qui marche

- **Numéro** : `5555555555554444`
- **Date expiration** : n'importe quelle date future
- **CVV** : `123`

### Carte de test qui échoue

- **Numéro** : `5555555555554002`
- **Date expiration** : n'importe quelle date future
- **CVV** : `123`

## Vérifier le paiement

Dashboard Supabase → Table Explorer → `orders`

Chercher la commande par `numero` (ex: BE-1234)

Colonnes à vérifier :
- `statut` = "payee" (si paiement OK)
- `paygreen_transaction_id` = ID de la transaction Paygreen
- `paygreen_status` = "SUCCESSED"
- `payment_confirmed_at` = timestamp de confirmation

## Logs

Voir les logs des Edge Functions :

```bash
# Logs create-payment
supabase functions logs create-payment

# Logs webhook
supabase functions logs paygreen-webhook
```

Ou dans le dashboard Supabase → Edge Functions → Logs

## Dépannage

### Erreur : "URL de paiement non reçue"

→ Vérifier les logs de `create-payment`
→ Vérifier que la clé secrète est bien configurée dans Supabase secrets

### Le webhook ne se déclenche pas

→ Vérifier l'URL du webhook dans le dashboard Paygreen
→ Vérifier que l'URL est bien accessible publiquement
→ Voir les logs du webhook dans Supabase

### Commande reste en "pending"

→ Le webhook n'a pas été reçu
→ Vérifier les logs Paygreen + Supabase
→ Mettre à jour manuellement dans la table `orders` :
```sql
UPDATE orders SET statut = 'payee', paygreen_status = 'SUCCESSED' WHERE numero = 'BE-1234';
```

## Contact Paygreen

- Dashboard : https://dashboard.paygreen.fr
- Support : support@paygreen.fr
- Docs API : https://paygreen.fr/documentation

## TODO

- [ ] Ajouter envoi d'email de confirmation après paiement (via Resend ou SendGrid)
- [ ] Gérer les remboursements depuis l'admin
- [ ] Ajouter retry automatique en cas d'échec webhook
- [ ] Implémenter 3D Secure pour les paiements > 30€
