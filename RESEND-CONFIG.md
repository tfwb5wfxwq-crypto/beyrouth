# Configuration Resend pour beyrouth.express

## ✅ FAIT
- ✅ Edge Functions créées (`send-receipt`, `send-order-notification`)
- ✅ `RESEND_API_KEY` configurée dans Supabase Secrets
- ✅ Webhook PayGreen intégré pour envoi automatique après paiement
- ✅ Admin intégré pour envoi automatique quand commande acceptée

## 🔧 À FAIRE : Configuration DNS

Pour que les emails n'arrivent PAS en spam, il faut configurer les DNS de **beyrouth.express** dans OVH.

### 1. Obtenir les records DNS depuis Resend

1. Aller sur https://resend.com/domains
2. Cliquer sur le domaine **beyrouth.express** (ou l'ajouter s'il n'existe pas)
3. Copier les 3 types de records DNS fournis par Resend

### 2. Ajouter les records dans OVH

Se connecter sur https://www.ovh.com/manager/web/#/zone/beyrouth.express

#### SPF Record (obligatoire)
- **Type** : TXT
- **Sous-domaine** : @ (ou vide)
- **Valeur actuelle** : `v=spf1 include:mx.ovh.com -all`
- **Nouvelle valeur** : `v=spf1 include:mx.ovh.com include:_spf.resend.com -all`

⚠️ **Modifier** le record existant, ne pas en créer un nouveau !

#### DKIM Records (obligatoire pour éviter spam)
Resend fournit 2-3 records DKIM, format typique :
- **Type** : TXT
- **Sous-domaine** : `resend._domainkey` (ou similaire selon Resend)
- **Valeur** : `v=DKIM1; k=rsa; p=MIGfMA0G...` (longue clé publique)

#### DMARC Record (recommandé)
- **Type** : TXT
- **Sous-domaine** : `_dmarc`
- **Valeur** : `v=DMARC1; p=none; rua=mailto:dmarc@beyrouth.express`

### 3. Vérifier la configuration

Après propagation DNS (10-30 min), vérifier avec :

```bash
# SPF
dig TXT beyrouth.express +short | grep spf

# DKIM (remplacer par le bon sélecteur Resend)
dig TXT resend._domainkey.beyrouth.express +short

# DMARC
dig TXT _dmarc.beyrouth.express +short
```

### 4. Vérifier dans Resend

Sur https://resend.com/domains, le statut du domaine doit passer à **Verified** (vert).

## 📧 Domaines d'envoi configurés

Les emails sont envoyés depuis :
- `commande@beyrouth.express` (send-receipt, send-order-notification)
- `noreply@beyrouth.express` (send-confirmation-email - pas encore déployée)

⚠️ Ces adresses email n'ont PAS besoin d'exister réellement, Resend s'en occupe.

## 🧪 Test

Une fois les DNS configurés, tester en :
1. Créant une commande de test sur le site
2. Payant avec PayGreen
3. Vérifier que l'email arrive bien dans la boîte de réception (et pas spam)

## 📊 Monitoring

- Logs des emails : https://resend.com/emails
- Taux de délivrabilité : https://resend.com/analytics
- Bounces/Spam : https://resend.com/suppressions

## 🔍 Troubleshooting

### Email arrive toujours en spam
- Vérifier que les 3 DNS (SPF, DKIM, DMARC) sont bien configurés
- Attendre 24-48h pour la réputation du domaine
- Vérifier les logs Resend pour les erreurs

### Email non reçu
- Vérifier les logs Supabase Edge Functions
- Vérifier les logs Resend
- Vérifier que `RESEND_API_KEY` est bien configurée dans Supabase Secrets

### Erreur CORS
- Vérifier que `corsHeaders` est bien configuré dans les Edge Functions
- Les Edge Functions doivent gérer OPTIONS preflight

## 🔐 Sécurité

- `RESEND_API_KEY` est stockée dans **Supabase Secrets** (jamais dans le code)
- Les emails sont envoyés côté serveur (Edge Functions), jamais depuis le client
- Le webhook PayGreen est sécurisé avec HMAC signature
