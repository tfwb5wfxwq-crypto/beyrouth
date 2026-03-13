// Supabase Edge Function: Initier le flow OAuth Edenred - Génère l'URL d'autorisation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// URLs Edenred UAT (Test)
const EDENRED_AUTHORIZE_URL = 'https://sso.sbx.edenred.io/authorize'
const REDIRECT_URI = 'https://beyrouth.express/?edenred_oauth=1'

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
    const { orderNum } = await req.json()

    if (!orderNum) {
      return new Response(
        JSON.stringify({ error: 'orderNum requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer client ID depuis Supabase Secrets
    const clientId = Deno.env.get('EDENRED_AUTH_CLIENT_ID')

    if (!clientId) {
      throw new Error('EDENRED_AUTH_CLIENT_ID manquant')
    }

    // Générer l'URL d'autorisation OAuth
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'directpayment',
      state: orderNum // Pour retrouver la commande au retour
    })

    const authorizationUrl = `${EDENRED_AUTHORIZE_URL}?${authParams.toString()}`

    console.log(`🔐 URL OAuth générée pour commande ${orderNum}`)

    return new Response(
      JSON.stringify({
        authorizationUrl: authorizationUrl,
        redirectUri: REDIRECT_URI
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur génération URL OAuth:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
