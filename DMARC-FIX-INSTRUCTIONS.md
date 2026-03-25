# 🔧 CORRIGER DMARC - Instructions OVH

**Date:** 25 mars 2026
**Domaine:** beyrouth.express

---

## 🎯 OBJECTIF

Passer DMARC de `p=none` → `p=quarantine` pour que iCloud Mail accepte les emails en INBOX.

---

## 📋 INSTRUCTIONS PRÉCISES

### Étape 1 : Se connecter à OVH

1. Aller sur https://www.ovh.com/manager/web/
2. Se connecter avec ton compte OVH
3. Aller dans **Noms de domaine** → **beyrouth.express**
4. Cliquer sur **Zone DNS**

### Étape 2 : Modifier le record DMARC

1. Chercher dans la liste le record **`_dmarc`** (Type: TXT)
2. Cliquer sur les **3 points** → **Modifier**
3. Remplacer la valeur actuelle par :

```
v=DMARC1; p=quarantine; rua=mailto:commande@beyrouth.express; pct=100; adkim=r; aspf=r
```

**Détails :**
- `p=quarantine` : Mettre en spam si DMARC échoue (au lieu de rien faire)
- `pct=100` : Appliquer à 100% des emails (pas seulement 10%)
- `adkim=r` : DKIM en mode relaxed
- `aspf=r` : SPF en mode relaxed

4. **Sauvegarder**

### Étape 3 : Attendre propagation DNS

⏱️ **Attendre 1-2 heures** pour que le changement se propage.

### Étape 4 : Vérifier

```bash
dig +short TXT _dmarc.beyrouth.express
```

**Résultat attendu :**
```
"v=DMARC1; p=quarantine; rua=mailto:commande@beyrouth.express; pct=100; adkim=r; aspf=r"
```

---

## ✅ RÉSULTAT ATTENDU

**AVANT (emails en spam iCloud) :**
```
p=none → iCloud ne sait pas quoi faire → SPAM
```

**APRÈS (emails en inbox iCloud) :**
```
p=quarantine → iCloud fait confiance → INBOX ✅
```

**Marche aussi pour :**
- ✅ Gmail
- ✅ Outlook
- ✅ Yahoo
- ✅ Tous les autres providers

---

## 🧪 TEST APRÈS MODIFICATION

**Envoyer un email de test :**

```bash
curl -X POST https://api.resend.com/emails \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "A Beyrouth <commande@beyrouth.express>",
    "to": "TON_EMAIL_ICLOUD@icloud.com",
    "subject": "✅ Test DMARC corrigé - Beyrouth Express",
    "html": "<h1>Test réussi !</h1><p>Si tu reçois ça en INBOX (pas spam), DMARC est OK !</p>"
  }'
```

**Vérifier :**
- Ouvrir Mail sur iPhone/Mac
- Checker INBOX (pas spam)
- Si c'est là → ✅ DMARC OK

---

**Note:** Il peut falloir 24-48h pour que iCloud Mail "apprenne" que beyrouth.express est légitime après le changement DMARC.
