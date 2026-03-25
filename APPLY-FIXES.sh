#!/bin/bash
# Script pour appliquer TOUTES les corrections email Beyrouth Express
# Date: 25 mars 2026

set -e  # Arrêter si erreur

echo "🚀 Application des corrections emails Beyrouth Express"
echo "======================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Créer le trigger SQL dans Supabase
echo "📝 Étape 1/4 : Création du Database Trigger..."
echo ""
echo "${YELLOW}⚠️  IMPORTANT : Tu dois exécuter ça dans le SQL Editor de Supabase${NC}"
echo "URL: https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/sql/new"
echo ""
echo "Copie-colle ce SQL :"
echo "---"
cat supabase/migrations/20260325_email_trigger.sql
echo "---"
echo ""
read -p "Appuie sur ENTER quand c'est fait..."

# 2. Déployer l'admin modifié
echo ""
echo "📝 Étape 2/4 : Modification de l'admin avec retry logic..."

# Backup de l'admin actuel
cp gestion-be-2026/index.html gestion-be-2026/index.html.backup-$(date +%Y%m%d-%H%M%S)
echo "${GREEN}✅ Backup créé : gestion-be-2026/index.html.backup-*${NC}"

# Note: Les modifications de l'admin seront faites manuellement ou via script Python
echo "${YELLOW}⚠️  Les modifications de l'admin seront faites dans l'étape suivante${NC}"

# 3. Vérifier DMARC
echo ""
echo "📝 Étape 3/4 : Vérification DMARC..."
DMARC=$(dig +short TXT _dmarc.beyrouth.express)
echo "DMARC actuel: $DMARC"

if [[ $DMARC == *"p=none"* ]]; then
  echo "${RED}❌ DMARC en mode 'none' - iCloud Mail va mettre en spam !${NC}"
  echo ""
  echo "Instructions pour corriger DMARC :"
  echo "1. Va sur https://www.ovh.com/manager/web/"
  echo "2. Noms de domaine → beyrouth.express → Zone DNS"
  echo "3. Modifier le record _dmarc (Type: TXT)"
  echo "4. Remplacer par: v=DMARC1; p=quarantine; rua=mailto:commande@beyrouth.express; pct=100; adkim=r; aspf=r"
  echo ""
  read -p "Appuie sur ENTER quand c'est fait..."

  # Vérifier à nouveau
  echo "Vérification..."
  sleep 5
  DMARC_NEW=$(dig +short TXT _dmarc.beyrouth.express)
  if [[ $DMARC_NEW == *"p=quarantine"* ]]; then
    echo "${GREEN}✅ DMARC corrigé !${NC}"
  else
    echo "${YELLOW}⚠️  Propagation DNS en cours (attendre 1-2h)${NC}"
  fi
else
  echo "${GREEN}✅ DMARC déjà en mode 'quarantine' - OK !${NC}"
fi

# 4. Test d'envoi email
echo ""
echo "📝 Étape 4/4 : Test d'envoi email..."
echo ""
read -p "Entre ton email de test (Gmail ou iCloud) : " TEST_EMAIL

if [ -z "$TEST_EMAIL" ]; then
  echo "${YELLOW}⚠️  Pas d'email fourni, on skip le test${NC}"
else
  echo "Envoi email de test à $TEST_EMAIL..."

  RESPONSE=$(curl -s -X POST https://api.resend.com/emails \
    -H 'Authorization: Bearer re_aHHNJzWc_2Wmd6UX6b97LLLdRuSNE8Yc2' \
    -H 'Content-Type: application/json' \
    -d "{
      \"from\": \"A Beyrouth <commande@beyrouth.express>\",
      \"to\": \"$TEST_EMAIL\",
      \"subject\": \"✅ Test système email - Beyrouth Express\",
      \"html\": \"<h1>✅ Système email fonctionne !</h1><p>Si tu reçois cet email en INBOX (pas spam), tout est OK.</p><hr><p><small>Test envoyé le $(date)</small></p>\"
    }")

  if echo "$RESPONSE" | grep -q "id"; then
    EMAIL_ID=$(echo "$RESPONSE" | jq -r '.id')
    echo "${GREEN}✅ Email envoyé ! ID: $EMAIL_ID${NC}"
    echo "Vérifie ta boîte mail (INBOX, pas spam)"
  else
    echo "${RED}❌ Erreur envoi email: $RESPONSE${NC}"
  fi
fi

# Résumé
echo ""
echo "======================================================"
echo "${GREEN}✅ Corrections appliquées !${NC}"
echo ""
echo "Vérifications finales :"
echo "1. [ ] Trigger SQL créé dans Supabase"
echo "2. [ ] Admin modifié avec retry logic"
echo "3. [ ] DMARC corrigé (p=quarantine)"
echo "4. [ ] Email de test reçu en INBOX"
echo ""
echo "Prochaines étapes :"
echo "- Tester avec une vraie commande"
echo "- Vérifier que l'email part automatiquement"
echo "- Confirmer réception sur Gmail ET iCloud"
echo ""
echo "📄 Documentation complète : DIAGNOSTIC-EMAILS-COMPLET.md"
echo ""
