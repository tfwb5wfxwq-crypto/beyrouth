# Configuration Email Receipt — Resend

## 1. Créer un compte Resend

1. Aller sur https://resend.com/signup
2. S'inscrire (gratuit 3000 emails/mois)
3. Vérifier l'email de confirmation

## 2. Obtenir la clé API

1. Dashboard Resend → Settings → API Keys
2. Créer une nouvelle clé : "Beyrouth Production"
3. Copier la clé (format : `re_xxxxxxxxxxxxx`)

## 3. Configurer le domaine (optionnel mais recommandé)

### Option A : Utiliser resend.com (sans config DNS)
- Email d'envoi : `onboarding@resend.dev` (par défaut)
- Fonctionne immédiatement mais moins pro

### Option B : Utiliser beyrouth.express (recommandé)
1. Dashboard Resend → Domains → Add Domain
2. Entrer : `beyrouth.express`
3. Ajouter les DNS records fournis chez l'hébergeur (OVH)
4. Attendre vérification DNS (~15 min)
5. Email d'envoi devient : `commande@beyrouth.express`

**DNS Records à ajouter sur OVH :**
```
Type: TXT
Nom: @
Valeur: (fourni par Resend, ex: "v=spf1 include:_spf.resend.com ~all")

Type: CNAME
Nom: resend._domainkey
Valeur: (fourni par Resend)
```

## 4. Configurer Supabase

### Via Supabase CLI :
```bash
cd ~/beyrouth
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxxx"
```

### Via Dashboard Web :
1. https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt
2. Settings → Secrets → New secret
3. Nom : `RESEND_API_KEY`
4. Valeur : `re_xxxxxxxxxxxxx`

## 5. Déployer la fonction

```bash
cd ~/beyrouth
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase functions deploy send-receipt
```

## 6. Tester

1. Aller sur beyrouth.express
2. Ajouter un article au panier
3. Remplir le formulaire (avec un vrai email)
4. ✅ Cocher "Recevoir mon reçu par email"
5. Commander
6. Vérifier la boîte email

## 7. Vérifier les logs

### Via CLI :
```bash
supabase functions logs send-receipt --limit 20
```

### Via Dashboard :
https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/functions/send-receipt/logs

## 8. Exemple d'email envoyé

```
De : A Beyrouth <commande@beyrouth.express>
À : client@exemple.fr
Sujet : ✅ Commande BE-1234 confirmée — A Beyrouth

[Email HTML avec :]
- Logo 🧆
- Numéro de commande BE-1234
- Nom du client + heure de retrait
- Liste des articles commandés
- Total
- Bouton "Suivre ma commande"
```

## Résumé des changements

### Fichiers créés :
- `supabase/functions/send-receipt/index.ts` — Edge Function envoi email

### Fichiers modifiés :
- `index.html` :
  - ➕ Checkbox "Recevoir mon reçu par email" (cochée par défaut)
  - ➕ Appel `send-receipt` dans `showConfirmation()` si checkbox cochée

### Fonctionnalité :
✅ LocalStorage pré-remplissage client (déjà présent)
✅ Email de reçu optionnel après commande (nouveau)
❌ Pas de code PIN (trop complexe pour un resto)

## Coût

**Resend Free Tier :**
- 3000 emails/mois gratuits
- Au-delà : 1$/1000 emails
- Pour un petit resto : largement suffisant

## Support

Si problème :
- Logs Supabase : voir section 7
- Support Resend : help@resend.com
- Documentation : https://resend.com/docs
