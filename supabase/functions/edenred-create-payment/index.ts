// Supabase Edge Function pour créer un paiement Edenred Ticket Restaurant sécurisé
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred UAT (Test)
const EDENRED_AUTH_URL = 'https://sso.sbx.edenred.io/oauth2/token'
const EDENRED_PAYMENT_URL = 'https://directpayment.stg.eu.edenred.io/v2/payment'
const EDENRED_MID = '1418943' // Merchant ID UAT

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

    // ===== ÉTAPE 1 : Obtenir le token OAuth Edenred =====
    const authBasic = btoa(`${EDENRED_AUTH_CLIENT_ID}:${EDENRED_AUTH_CLIENT_SECRET}`)

    const authResponse = await fetch(EDENRED_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authBasic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'directpayment'
      })
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('Erreur Auth Edenred:', authResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `Authentification Edenred échouée (${authResponse.status})` }),
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
      returnUrl: `https://beyrouth.express/confirmation.html?num=${orderNum}&payment=edenred`,
      cancelUrl: `https://beyrouth.express/?cancelled=1&payment=edenred`
    }

    const paymentResponse = await fetch(EDENRED_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    })

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('Erreur Payment Edenred:', paymentResponse.status, errorText)

      let edenredError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        edenredError = errorJson.message || errorJson.error || errorText
      } catch (e) {
        // Si pas JSON, utiliser le texte brut
      }

      return new Response(
        JSON.stringify({
          error: `Paiement Edenred échoué (${paymentResponse.status}): ${edenredError}`
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
