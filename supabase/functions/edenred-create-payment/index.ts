// Supabase Edge Function pour créer un paiement Edenred Ticket Restaurant sécurisé
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred PRODUCTION
const EDENRED_AUTH_URL = 'https://sso.edenred.io/connect/token'
const EDENRED_PAYMENT_URL = 'https://directpayment.eu.edenred.io/v2/payment'
const EDENRED_MID = '1422285' // Merchant ID PROD (SARL PAPA)

// Credentials depuis Supabase Secrets
const EDENRED_AUTH_CLIENT_ID = Deno.env.get('EDENRED_AUTH_CLIENT_ID') ?? ''
const EDENRED_AUTH_CLIENT_SECRET = Deno.env.get('EDENRED_AUTH_CLIENT_SECRET') ?? ''
const EDENRED_PAYMENT_CLIENT_ID = Deno.env.get('EDENRED_PAYMENT_CLIENT_ID') ?? ''
const EDENRED_PAYMENT_CLIENT_SECRET = Deno.env.get('EDENRED_PAYMENT_CLIENT_SECRET') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderNum, total, email, name, phone, pickup } = await req.json()

    // Validation params
    if (!orderNum || !total || !email || !name) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Init Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Debug: vérifier que les credentials sont présents
    console.log('🔍 Debug credentials:', {
      authClientId: EDENRED_AUTH_CLIENT_ID ? `${EDENRED_AUTH_CLIENT_ID.substring(0, 8)}...` : 'MANQUANT',
      authSecret: EDENRED_AUTH_CLIENT_SECRET ? 'PRESENT' : 'MANQUANT',
      paymentClientId: EDENRED_PAYMENT_CLIENT_ID ? `${EDENRED_PAYMENT_CLIENT_ID.substring(0, 8)}...` : 'MANQUANT',
      paymentSecret: EDENRED_PAYMENT_CLIENT_SECRET ? 'PRESENT' : 'MANQUANT'
    })

    // ===== ÉTAPE 1 : Obtenir le token OAuth Edenred =====
    console.log('🔐 Tentative auth OAuth Edenred sur:', EDENRED_AUTH_URL)
    const authResponse = await fetch(EDENRED_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: EDENRED_AUTH_CLIENT_ID,
        client_secret: EDENRED_AUTH_CLIENT_SECRET,
        scope: 'directpayment'
      })
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('❌ Erreur Auth Edenred:', authResponse.status, errorText)

      // Parser l'erreur JSON si possible
      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = JSON.stringify(errorJson, null, 2)
      } catch (e) {}

      return new Response(
        JSON.stringify({
          error: `Authentification Edenred échouée (${authResponse.status})`,
          details: errorDetails,
          url: EDENRED_AUTH_URL,
          hasClientId: !!EDENRED_AUTH_CLIENT_ID,
          hasClientSecret: !!EDENRED_AUTH_CLIENT_SECRET
        }),
        { status: authResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authData = await authResponse.json()
    const accessToken = authData.access_token

    if (!accessToken) {
      console.error('Access token Edenred non reçu:', authData)
      return new Response(
        JSON.stringify({ error: 'Token Edenred non reçu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Token Edenred OAuth obtenu')

    // ===== ÉTAPE 2 : Créer le paiement Edenred =====
    const paymentPayload = {
      merchantId: EDENRED_MID,
      amount: {
        value: total, // Déjà en centimes (ex: 1250 pour 12.50€)
        currency: 'EUR'
      },
      merchantReference: orderNum,
      returnUrl: `https://beyrouth.express/?edenred_return=1&order=${orderNum}`,
      cancelUrl: `https://beyrouth.express/?edenred_cancelled=1`
    }

    // Retry logic pour 502 (serveurs Edenred instables en UAT)
    let paymentResponse
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      attempts++
      console.log(`🔄 Tentative ${attempts}/${maxAttempts} création paiement Edenred`)

      paymentResponse = await fetch(EDENRED_PAYMENT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(paymentPayload)
      })

      // Si succès, sortir de la boucle
      if (paymentResponse.ok) break

      // Si 502, retry après 1s
      if (paymentResponse.status === 502 && attempts < maxAttempts) {
        console.warn(`⚠️ Erreur 502, retry dans 1s (tentative ${attempts}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      // Autre erreur, ne pas retry
      break
    }

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('❌ Erreur Payment Edenred après', attempts, 'tentatives:', paymentResponse.status, errorText)

      let edenredError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        edenredError = JSON.stringify(errorJson)
      } catch (e) {
        // Si pas JSON, utiliser le texte brut
      }

      return new Response(
        JSON.stringify({
          error: `Échec création paiement Edenred (${paymentResponse.status})`,
          details: edenredError,
          attempts: attempts,
          note: paymentResponse.status === 502 ? 'Serveurs Edenred UAT instables. Utilisez PayGreen ou réessayez dans quelques minutes.' : 'Erreur API Edenred'
        }),
        {
          status: paymentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const paymentData = await paymentResponse.json()
    console.log('Edenred payment response:', JSON.stringify(paymentData))

    // L'API Edenred retourne une URL de paiement (redirectUrl) et un paymentId
    const paymentUrl = paymentData.redirectUrl || paymentData.paymentUrl
    const paymentId = paymentData.paymentId || paymentData.id

    if (!paymentUrl || !paymentId) {
      console.error('Données Edenred invalides:', paymentData)
      return new Response(
        JSON.stringify({
          error: 'Réponse Edenred invalide',
          debug: paymentData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour la commande avec l'ID de transaction Edenred
    await supabase
      .from('orders')
      .update({
        edenred_payment_id: paymentId,
        edenred_status: 'pending'
      })
      .eq('numero', orderNum)

    console.log('✅ Paiement Edenred créé:', paymentId)

    return new Response(
      JSON.stringify({
        paymentId: paymentId,
        paymentUrl: paymentUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
