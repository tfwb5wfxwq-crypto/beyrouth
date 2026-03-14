# Resend - Configuration Beyrouth Express

## API Key
```
re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2
```

**Type:** API Key (read/write)
**Créée:** 14 mars 2026

## Domaine

- **Domain:** beyrouth.express
- **Domain ID:** 42740492-cec2-40ef-82e2-607dc105e7f0
- **Status:** ✅ verified
- **Région:** eu-west-1 (Irlande)
- **Créé:** 27 février 2026
- **Capabilities:** Sending enabled, Receiving disabled

## DNS Records (tous ✅ verified)

### DKIM
```
Type: TXT
Name: resend._domainkey.beyrouth.express
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGq4zcZ0OjCp7JLLqyt/NKJBVNCDCrsCUTaBcmd78kyA7nQ8kgfmAveCqV62NEfopW4ExLI66XUBBIufFOECG4f2fy32Nbf9ZakJQbvX2+xwW6VQrKQHStJjjM0WqaB3tNbA1RJi5as55q0YnPeWO7RWECjhQsQkofQnHM10kBjwIDAQAB
Status: ✅ verified
```

### SPF (MX)
```
Type: MX
Name: send.beyrouth.express
Value: feedback-smtp.eu-west-1.amazonses.com
Priority: 10
Status: ✅ verified
```

### SPF (TXT)
```
Type: TXT
Name: send.beyrouth.express
Value: v=spf1 include:amazonses.com ~all
Status: ✅ verified
```

## Email Configuration

**From addresses utilisées:**
- `commande@beyrouth.express` (emails transactionnels)
- `contact@beyrouth.express` (reply-to)

**Templates:**
- `send-order-confirmation` - Email après acceptation commande
- `send-payment-confirmation` - Email après paiement (en attente validation)
- `send-test-email` - Email de test

## Quick Check

```bash
# Lister domaines
curl -s https://api.resend.com/domains \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' | jq .

# Détails domaine beyrouth.express
curl -s https://api.resend.com/domains/42740492-cec2-40ef-82e2-607dc105e7f0 \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' | jq .

# Envoyer email de test
curl -X POST https://api.resend.com/emails \
  -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "A Beyrouth <commande@beyrouth.express>",
    "to": "test@example.com",
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

## Notes

- ✅ DNS configurés le 27 février 2026
- ✅ Tous les records sont verified
- ✅ Sending enabled
- ⚠️ iCloud Mail peut filtrer agressivement même avec DNS OK (demander aux clients de sortir des spams manuellement)
- Tracking: Click ON, Open OFF (meilleur pour délivrabilité)
