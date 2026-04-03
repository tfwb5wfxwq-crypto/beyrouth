// Supabase Edge Function: Remboursement PayGreen (sécurisé)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// CORS permissif pour beyrouth.express (avec et sans www)
const allowedOrigins = ['https://beyrouth.express', 'https://www.beyrouth.express']

// 🔒 Helper pour fetch avec timeout (évite hang infini si API externe down)
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
  // Détecter l'origin et renvoyer le header CORS approprié
  const origin = req.headers.get('origin') || ''
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const debugLogs: string[] = []

  try {
    // 🔒 SÉCURITÉ: Validation token admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token admin requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    // Importer createClient pour valider le token
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

        // 🔒 Valider le JWT Supabase Auth
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(adminToken)
    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { transactionId, amount } = await req.json()

    // Validation params
    if (!transactionId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (transactionId, amount requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    debugLogs.push(`💳 Remboursement PayGreen: ${transactionId}`)
    debugLogs.push(`💰 Montant: ${amount} centimes`)

    // Récupérer les secrets depuis Supabase Secrets (sécurisé)
    const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY')
    const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID')

    debugLogs.push(`🔑 SECRET_KEY: ${PAYGREEN_SECRET_KEY ? PAYGREEN_SECRET_KEY.substring(0, 10) + '...' : '❌ UNDEFINED'}`)
    debugLogs.push(`🏪 SHOP_ID: ${PAYGREEN_SHOP_ID || '❌ UNDEFINED'}`)

    if (!PAYGREEN_SECRET_KEY || !PAYGREEN_SHOP_ID) {
      return new Response(
        JSON.stringify({
          error: 'Secrets PayGreen non configurés',
          debugLogs
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ MÉTHODE QUI MARCHE (testée avec test-paygreen-refund)

    // Étape 1: Authentification PayGreen pour obtenir JWT token
    debugLogs.push(`\n📡 Authentification...`)
    const authUrl = `https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`
    debugLogs.push(`URL: ${authUrl}`)

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

    debugLogs.push(`Auth Status: ${authResponse.status}`)

    if (!authResponse.ok) {
      const errorText = await authResponse.text()
      debugLogs.push(`❌ Auth échouée: ${errorText}`)
      return new Response(
        JSON.stringify({ error: 'Auth PayGreen échouée', debugLogs }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authData = await authResponse.json()
    const jwtToken = authData.data?.token || authData.token

    if (!jwtToken) {
      debugLogs.push(`❌ JWT token non reçu`)
      return new Response(
        JSON.stringify({ error: 'JWT non reçu', debugLogs }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    debugLogs.push(`✅ JWT reçu: ${jwtToken.substring(0, 20)}...`)

    // Étape 2: Refund Payment Order
    debugLogs.push(`\n💸 Refund Payment Order...`)
    const refundUrl = `https://api.paygreen.fr/payment/payment-orders/${transactionId}/refund`
    debugLogs.push(`URL: ${refundUrl}`)

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

    debugLogs.push(`Refund Status: ${refundResponse.status}`)

    if (!refundResponse.ok) {
      const errorText = await refundResponse.text()
      debugLogs.push(`❌ Refund échoué: ${errorText}`)

      return new Response(
        JSON.stringify({
          error: `Erreur remboursement PayGreen (${refundResponse.status})`,
          details: errorText,
          debugLogs
        }),
        {
          status: refundResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const refundData = await refundResponse.json()
    debugLogs.push(`✅ Refund réussi !`)
    debugLogs.push(`Refund data: ${JSON.stringify(refundData)}`)

    console.log(debugLogs.join('\n'))

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionId,
        amount: amount,
        refundData: refundData,
        debugLogs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur remboursement PayGreen:', error)
    debugLogs.push(`❌ Exception: ${error.message}`)

    return new Response(
      JSON.stringify({
        error: error.message,
        debugLogs
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
