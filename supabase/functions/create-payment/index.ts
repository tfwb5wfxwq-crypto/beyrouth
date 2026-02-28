// Supabase Edge Function pour créer un paiement Paygreen sécurisé
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYGREEN_API_URL = 'https://api.paygreen.fr/payment/payment-orders'
const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY') ?? ''
const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID') ?? ''

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
    const { orderNum, total, email, name, phone, pickup, note, items } = await req.json()

    // Validation
    if (!orderNum || !total || !email || !name) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Étape 1 : Obtenir un JWT token depuis l'Auth API
    const authResponse = await fetch(`https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`, {
      method: 'POST',
      headers: {
        'Authorization': PAYGREEN_SECRET_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      console.error('Erreur Auth Paygreen:', authResponse.status, errorText)
      return new Response(
        JSON.stringify({ error: `Auth Paygreen (${authResponse.status}): ${errorText}` }),
        { status: authResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authData = await authResponse.json()
    const jwtToken = authData.data?.token || authData.token

    if (!jwtToken) {
      console.error('JWT token non reçu:', authData)
      return new Response(
        JSON.stringify({ error: 'JWT token non reçu de PayGreen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Séparer prénom/nom (PayGreen exige lastName non vide)
    const nameParts = name.trim().split(' ')
    const firstName = nameParts[0] || 'Client'
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || 'Beyrouth'

    // Étape 2 : Créer la requête de paiement Paygreen (API v3)
    const paygreenPayload = {
      reference: orderNum,
      amount: total, // Déjà en centimes
      currency: 'eur',
      mode: 'instant',
      auto_capture: true,
      shop_id: PAYGREEN_SHOP_ID,
      description: `Commande ${orderNum} - Beyrouth Express`,
      return_url: `https://beyrouth.express/commande.html?num=${orderNum}&status=success`,
      cancel_url: `https://beyrouth.express/commande.html?num=${orderNum}&status=cancelled`,
      buyer: {
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || ''
      },
      metadata: {
        pickup_time: pickup || 'asap',
        note: note || '',
        items_count: items?.length || 0
      }
    }

    // Appeler l'API Paygreen avec JWT token
    const paygreenResponse = await fetch(PAYGREEN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(paygreenPayload)
    })

    if (!paygreenResponse.ok) {
      const errorText = await paygreenResponse.text()
      console.error('Erreur Paygreen:', paygreenResponse.status, errorText)

      // Essayer de parser l'erreur JSON de Paygreen
      let paygreenError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        paygreenError = errorJson.message || errorJson.error || errorText
      } catch (e) {
        // Si pas JSON, utiliser le texte brut
      }

      return new Response(
        JSON.stringify({
          error: `Paygreen (${paygreenResponse.status}): ${paygreenError}`
        }),
        {
          status: paygreenResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const paygreenData = await paygreenResponse.json()
    console.log('PayGreen response:', JSON.stringify(paygreenData))

    // Extraire les données (PayGreen peut renvoyer {data: {...}} ou directement {...})
    const paymentOrder = paygreenData.data || paygreenData
    const paymentUrl = paymentOrder.hosted_payment_url || paymentOrder.url
    const transactionId = paymentOrder.id
    const objectSecret = paymentOrder.object_secret

    if (!transactionId || !objectSecret) {
      console.error('Données PayGreen invalides:', paygreenData)
      return new Response(
        JSON.stringify({
          error: 'Réponse PayGreen invalide',
          debug: paygreenData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour la commande avec l'ID de transaction Paygreen
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase
      .from('orders')
      .update({
        paygreen_transaction_id: transactionId,
        paygreen_status: 'pending'
      })
      .eq('numero', orderNum)

    return new Response(
      JSON.stringify({
        paymentOrderId: transactionId,
        objectSecret: objectSecret,
        paymentUrl: paymentUrl // Fallback pour compatibilité
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
