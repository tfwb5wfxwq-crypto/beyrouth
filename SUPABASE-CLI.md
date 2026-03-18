# Supabase CLI - Beyrouth Express

## ✅ Configuration

**Project ref** : `xbuftfwcyontgqbbrrjt`
**Access Token** : `sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc`

**Projet linké** : ✅ `/Users/ludovik/beyrouth/.supabase/`

---

## 🚀 Commandes principales

### Edge Functions

```bash
# Déployer une fonction
cd ~/beyrouth
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase functions deploy <nom-fonction> --no-verify-jwt

# Exemple
supabase functions deploy edenred-oauth-callback --no-verify-jwt
```

### Base de données

```bash
# Pusher les migrations SQL
cd ~/beyrouth
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase db push

# Voir l'état de la base
supabase db diff

# Créer une nouvelle migration
supabase migration new nom-migration
# Crée : supabase/migrations/YYYYMMDDHHMMSS_nom-migration.sql
```

### Secrets

```bash
# Lister les secrets
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase secrets list

# Ajouter/modifier un secret
supabase secrets set NOM_SECRET=valeur

# Exemple
supabase secrets set EDENRED_AUTH_CLIENT_ID=abc123
```

### Logs

```bash
# Logs d'une Edge Function
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase functions logs edenred-oauth-callback

# Logs en temps réel
supabase functions logs edenred-oauth-callback --tail
```

---

## 📋 Workflow déploiement complet

```bash
cd ~/beyrouth

# 1. Switch compte GitHub
gh auth switch --user tfwb5wfxwq-crypto

# 2. Modifier le code...

# 3. Pusher les migrations SQL (si nécessaire)
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"
supabase db push

# 4. Déployer les Edge Functions
supabase functions deploy edenred-initiate-oauth --no-verify-jwt
supabase functions deploy edenred-oauth-callback --no-verify-jwt

# 5. Commit + push Git
git add .
git commit -m "Description des changements

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin main

# 6. Switch back
gh auth switch --user iarmy-dev
```

---

## 🔐 Table `oauth_states`

**Status** : ✅ Créée et configurée (migration 20260313140000)

**Structure** :
```sql
CREATE TABLE oauth_states (
  id BIGSERIAL PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  order_num TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);
```

**Fonction de nettoyage** : `cleanup_expired_oauth_states()`

**Index** : `idx_oauth_states_expires_at` sur `expires_at`

**RLS** : Activé (service_role only)

---

## 🔄 CSRF Protection

**Activée le 18 mars 2026** :
- ✅ Token cryptographique aléatoire (crypto.randomUUID())
- ✅ Stockage en base avec expiration (10 min)
- ✅ Vérification dans callback OAuth
- ✅ Suppression après usage unique
- ✅ CORS restreint à `beyrouth.express`

**Edge Functions concernées** :
- `edenred-initiate-oauth` : génère + stocke state
- `edenred-oauth-callback` : vérifie + supprime state

---

## ⚠️ Notes importantes

- **Docker pas nécessaire** pour déployer sur Supabase remote
- **Access token** valide jusqu'à révocation (stocker en sécurité)
- **Migrations** doivent avoir format `YYYYMMDDHHMMSS_name.sql`
- **Service role key** ne JAMAIS commit dans Git (dans secrets Supabase)

---

## 📞 Dépannage

### Erreur 403 Forbidden
→ Vérifier que `SUPABASE_ACCESS_TOKEN` est exporté

### Migration ignorée
→ Vérifier format nom fichier : `20260318173845_name.sql`

### Fonction ne se déploie pas
→ Vérifier syntaxe TypeScript dans `index.ts`
→ Logs avec `--debug`

### État base vs local
```bash
# Voir différences
supabase db diff

# Reset local (DANGER)
supabase db reset
```
