// Supabase Edge Function pour créer un paiement Paygreen sécurisé
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYGREEN_API_URL = 'https://api.paygreen.fr/payment/payment-orders'
const PAYGREEN_SECRET_KEY = 'sk_0564063e4ef04dbf93f588e7967e3e61'
const PAYGREEN_SHOP_ID = 'sh_55f9f298d8ce478db7b87117ec86ce11'

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

    // Créer la requête de paiement Paygreen
    const paygreenPayload = {
      amount: total, // Déjà en centimes
      currency: 'EUR',
      orderId: orderNum,
      returned_url: `https://beyrouth.express/commande.html?num=${orderNum}&status=success`,
      notified_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/paygreen-webhook`,
      buyer: {
        email: email,
        firstName: name,
        lastName: '',
        phone: phone || ''
      },
      metadata: {
        pickup_time: pickup || 'asap',
        note: note || '',
        items_count: items?.length || 0
      }
    }

    // Appeler l'API Paygreen
    const paygreenResponse = await fetch(PAYGREEN_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYGREEN_SECRET_KEY}`,
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

    // Mettre à jour la commande avec l'ID de transaction Paygreen
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabase
      .from('orders')
      .update({
        paygreen_transaction_id: paygreenData.id,
        paygreen_status: 'pending'
      })
      .eq('numero', orderNum)

    return new Response(
      JSON.stringify({
        paymentUrl: paygreenData.url || paygreenData.hosted_payment_url,
        transactionId: paygreenData.id
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
