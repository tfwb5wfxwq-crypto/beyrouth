// Supabase Edge Function: Callback OAuth Edenred - Échange code → token → payment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred UAT (Test)
const EDENRED_AUTH_URL = 'https://sso.sbx.edenred.io/connect/token'
const EDENRED_PAYMENT_URL = 'https://directpayment.stg.eu.edenred.io/v2/payment'
const EDENRED_MID = '1418943' // Merchant ID UAT

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, orderNum, total, redirectUri } = await req.json()

    // Validation params
    if (!code || !orderNum || !total || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (code, orderNum, total, redirectUri requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔐 OAuth callback Edenred: échange code pour commande ${orderNum}`)

    // Récupérer credentials depuis Supabase Secrets
    const authClientId = Deno.env.get('EDENRED_AUTH_CLIENT_ID') ?? ''
    const authClientSecret = Deno.env.get('EDENRED_AUTH_CLIENT_SECRET') ?? ''
    const paymentClientId = Deno.env.get('EDENRED_PAYMENT_CLIENT_ID') ?? ''
    const paymentClientSecret = Deno.env.get('EDENRED_PAYMENT_CLIENT_SECRET') ?? ''

    if (!authClientId || !authClientSecret) {
      throw new Error('Credentials OAuth Edenred manquants')
    }

    // ===== ÉTAPE 1 : Échanger le code contre un access_token =====
    console.log('📝 Échange code OAuth contre access_token...')
    const tokenResponse = await fetch(EDENRED_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: authClientId,
        client_secret: authClientSecret,
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Erreur échange code OAuth:', tokenResponse.status, errorText)

      let errorDetails = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = JSON.stringify(errorJson, null, 2)
      } catch (e) {}

      return new Response(
        JSON.stringify({
          error: `Échec échange code OAuth (${tokenResponse.status})`,
          details: errorDetails
        }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('❌ Access token non reçu:', tokenData)
      return new Response(
        JSON.stringify({ error: 'Token OAuth non reçu' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Access token OAuth obtenu')

    // ===== ÉTAPE 2 : Créer le paiement avec le token =====
    console.log('💳 Création paiement Edenred...')

    const paymentPayload = {
      merchantId: EDENRED_MID,
      amount: {
        value: total, // En centimes
        currency: 'EUR'
      },
      merchantReference: orderNum,
      returnUrl: `https://beyrouth.express/?edenred_return=1&order=${orderNum}`,
      cancelUrl: `https://beyrouth.express/?edenred_cancelled=1`
    }

    const paymentResponse = await fetch(EDENRED_PAYMENT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Client-Id': paymentClientId,
        'X-Client-Secret': paymentClientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    })

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('❌ Erreur création paiement Edenred:', paymentResponse.status, errorText)

      let edenredError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        edenredError = errorJson.message || errorJson.error || errorText
      } catch (e) {}

      return new Response(
        JSON.stringify({
          error: `Échec création paiement Edenred (${paymentResponse.status}): ${edenredError}`
        }),
        {
          status: paymentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const paymentData = await paymentResponse.json()
    console.log('✅ Paiement Edenred créé:', JSON.stringify(paymentData))

    const paymentUrl = paymentData.redirectUrl || paymentData.paymentUrl
    const paymentId = paymentData.paymentId || paymentData.id

    if (!paymentUrl || !paymentId) {
      console.error('❌ Réponse Edenred invalide:', paymentData)
      return new Response(
        JSON.stringify({
          error: 'Réponse Edenred invalide',
          debug: paymentData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour la commande avec payment ID
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase
      .from('orders')
      .update({
        edenred_payment_id: paymentId,
        edenred_status: 'pending'
      })
      .eq('numero', orderNum)

    console.log('✅ Flow OAuth Edenred complet, paymentUrl prête')

    return new Response(
      JSON.stringify({
        paymentId: paymentId,
        paymentUrl: paymentUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur OAuth callback:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
