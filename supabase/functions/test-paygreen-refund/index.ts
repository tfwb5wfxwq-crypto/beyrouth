// Edge Function TEST: Tester le refund PayGreen sans vraie commande
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Timeout API externe (${timeoutMs}ms)`)
    }
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentOrderId } = await req.json()

    if (!paymentOrderId) {
      return new Response(
        JSON.stringify({ error: 'paymentOrderId requis (ex: po_xxx)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const logs: string[] = []

    // Étape 1: Vérifier les secrets
    const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY')
    const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID')

    logs.push(`🔑 SECRET_KEY: ${PAYGREEN_SECRET_KEY ? PAYGREEN_SECRET_KEY.substring(0, 10) + '...' : '❌ UNDEFINED'}`)
    logs.push(`🏪 SHOP_ID: ${PAYGREEN_SHOP_ID || '❌ UNDEFINED'}`)
    logs.push(`💳 Payment Order ID: ${paymentOrderId}`)

    if (!PAYGREEN_SECRET_KEY || !PAYGREEN_SHOP_ID) {
      return new Response(
        JSON.stringify({
          error: 'Secrets non définis',
          logs
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Étape 2: Authentification
    logs.push(`\n📡 Authentification...`)
    const authUrl = `https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`
    logs.push(`URL: ${authUrl}`)

    const authResponse = await fetchWithTimeout(
      authUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': PAYGREEN_SECRET_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      10000
    )

    logs.push(`Auth Status: ${authResponse.status}`)

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      logs.push(`❌ Auth échouée: ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Auth échouée', logs }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authData = await authResponse.json()
    const jwtToken = authData.data?.token || authData.token

    if (!jwtToken) {
      logs.push(`❌ JWT token non reçu`)
      return new Response(
        JSON.stringify({ error: 'JWT non reçu', logs }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    logs.push(`✅ JWT reçu: ${jwtToken.substring(0, 20)}...`)

    // Étape 3: GET Payment Order
    logs.push(`\n📦 GET Payment Order...`)
    const getUrl = `https://api.paygreen.fr/payment/payment-orders/${paymentOrderId}`
    logs.push(`URL: ${getUrl}`)

    const getResponse = await fetchWithTimeout(
      getUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/json'
        }
      },
      10000
    )

    logs.push(`GET Status: ${getResponse.status}`)

    if (!getResponse.ok) {
      const errorText = await getResponse.text()
      logs.push(`❌ GET échoué: ${errorText}`)
    } else {
      const paymentOrder = await getResponse.json()
      logs.push(`✅ Payment Order récupéré`)
      logs.push(`Status: ${paymentOrder.data?.status || paymentOrder.status}`)
      logs.push(`Amount: ${paymentOrder.data?.original_amount || paymentOrder.original_amount} centimes`)
    }

    // Étape 4: Refund
    logs.push(`\n💸 Refund Payment Order...`)
    const refundUrl = `https://api.paygreen.fr/payment/payment-orders/${paymentOrderId}/refund`
    logs.push(`URL: ${refundUrl}`)

    const refundResponse = await fetchWithTimeout(
      refundUrl,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({})
      },
      10000
    )

    logs.push(`Refund Status: ${refundResponse.status}`)

    if (!refundResponse.ok) {
      const errorText = await refundResponse.text()
      logs.push(`❌ Refund échoué: ${errorText}`)
    } else {
      const refundData = await refundResponse.json()
      logs.push(`✅ Refund réussi !`)
      logs.push(`Refund data: ${JSON.stringify(refundData)}`)
    }

    return new Response(
      JSON.stringify({
        success: refundResponse.ok,
        logs,
        httpStatus: refundResponse.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
