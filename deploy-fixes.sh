#!/bin/bash
# Script de déploiement des corrections Beyrouth Express
# 14 mars 2026

set -e

echo "🚀 Déploiement Beyrouth Express - Fixes 14 mars 2026"
echo ""

# Export token Supabase
export SUPABASE_ACCESS_TOKEN="sbp_2bd6f3304ee399fb94bcc0252910d598944d30bc"

cd ~/beyrouth

echo "📧 Vérification RESEND_API_KEY..."
if ! supabase secrets list | grep -q "RESEND_API_KEY"; then
  echo "⚠️  RESEND_API_KEY manquant dans Supabase Secrets!"
  echo ""
  echo "👉 Configurez-le manuellement :"
  echo "   1. https://resend.com/api-keys → Create API Key"
  echo "   2. https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/settings/vault"
  echo "   3. supabase secrets set RESEND_API_KEY=re_xxxxx"
  echo ""
  read -p "Appuyez sur Entrée quand c'est fait..."
fi

echo ""
echo "🔧 Déploiement Edge Functions..."
supabase functions deploy send-order-confirmation --no-verify-jwt
supabase functions deploy send-payment-confirmation --no-verify-jwt
supabase functions deploy paygreen-webhook --no-verify-jwt
supabase functions deploy edenred-oauth-callback --no-verify-jwt

echo ""
echo "📤 Push admin fixes vers GitHub Pages..."
git add gestion-be-2026/index.html
git commit -m "Fix: admin logout localStorage + cleanup

- Fix doLogout() qui supprimait adminCode au lieu de adminToken
- Redirection vers login.html après logout
- Code simplifié
" || echo "Rien à commiter"

gh auth switch --user tfwb5wfxwq-crypto
git push origin main
gh auth switch --user iarmy-dev

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "🧪 Tests à faire :"
echo "  1. Admin logout → vérifier reconnexion"
echo "  2. Commande test → vérifier email confirmation"
echo "  3. Auto-accept activé → vérifier acceptation auto"
echo "  4. Commande future (demain) → vérifier pas en retard"
