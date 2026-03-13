// Supabase Edge Function: Callback OAuth Edenred - Échange code → token → payment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred UAT (Test)
const EDENRED_AUTH_URL = 'https://sso.sbx.edenred.io/connect/token'
const EDENRED_PAYMENT_URL = 'https://directpayment.stg.eu.edenred.io/v2/transactions'
const EDENRED_MID = '1418943' // Merchant ID UAT

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
    const { code, state, total, redirectUri } = await req.json()

    // Validation params
    if (!code || !state || !total || !redirectUri) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (code, state, total, redirectUri requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // VALIDATION CSRF : Vérifier le state
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('order_num')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (stateError || !stateData) {
      console.error('❌ State OAuth invalide ou expiré:', state)
      return new Response(
        JSON.stringify({ error: 'Session OAuth invalide ou expirée. Veuillez réessayer.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer le numéro de commande depuis la BDD (protection contre manipulation)
    const orderNum = stateData.order_num

    // Supprimer le state (usage unique)
    await supabase.from('oauth_states').delete().eq('state', state)

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
      order_ref: orderNum,
      mid: EDENRED_MID,
      amount: total, // En centimes (nombre entier)
      capture_mode: 'auto',
      extra_field: `beyrouth-${orderNum}`,
      tstamp: new Date().toISOString()
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

    // Vérifier le statut de la réponse Edenred
    if (paymentData.meta?.status !== 'succeeded') {
      console.error('❌ Paiement Edenred échoué:', paymentData)
      return new Response(
        JSON.stringify({
          error: 'Paiement Edenred échoué',
          details: paymentData.meta?.messages || paymentData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const captureId = paymentData.data?.capture_id || paymentData.data?.authorization_id
    const capturedAmount = paymentData.data?.captured_amount
    const transactionStatus = paymentData.data?.status

    if (!captureId || transactionStatus !== 'captured') {
      console.error('❌ Transaction non capturée:', paymentData)
      return new Response(
        JSON.stringify({
          error: 'Transaction non capturée',
          debug: paymentData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour la commande : paiement capturé = statut "payee"
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        edenred_payment_id: captureId,
        edenred_status: 'captured',
        statut: 'payee', // Paiement confirmé
        payment_confirmed_at: new Date().toISOString()
      })
      .eq('numero', orderNum)
      .select()

    if (updateError) {
      console.error('Erreur mise à jour commande:', updateError)
      throw updateError
    }

    console.log(`✅ Paiement Edenred capturé (${capturedAmount} centimes), commande ${orderNum} payée`)

    // Vérifier si auto-accept est activé (même logique que PayGreen webhook)
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()

    const autoAcceptEnabled = autoAcceptSetting?.value === 'true'

    // Envoyer email immédiat après paiement UNIQUEMENT si auto-accept DÉSACTIVÉ
    // (sinon email d'acceptation va suivre immédiatement)
    if (!autoAcceptEnabled && updatedOrder && updatedOrder[0]) {
      try {
        const emailResponse = await supabase.functions.invoke('send-payment-confirmation', {
          body: { orderId: updatedOrder[0].id }
        })

        if (emailResponse.error) {
          console.error('Erreur envoi email paiement:', emailResponse.error)
        } else {
          console.log(`📧 Email de confirmation paiement envoyé pour ${orderNum}`)
        }
      } catch (emailError) {
        console.error('Erreur appel send-payment-confirmation:', emailError)
        // Ne pas bloquer le callback si l'email échoue
      }
    } else if (autoAcceptEnabled) {
      console.log(`⏭️  Email paiement skippé (auto-accept activé, email d'acceptation va suivre)`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderNum: orderNum,
        captureId: captureId,
        amount: capturedAmount,
        status: 'captured'
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
