// Supabase Edge Function: Initier le flow OAuth Edenred - Génère l'URL d'autorisation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred UAT (Test)
const EDENRED_AUTHORIZE_URL = 'https://sso.sbx.edenred.io/connect/authorize'
const REDIRECT_URI = 'https://beyrouth.express/?edenred_oauth=1'

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

    // Générer un state aléatoire pour protection CSRF
    const state = crypto.randomUUID()

    // Stocker le state en BDD (expire dans 10 min)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: stateError } = await supabase
      .from('oauth_states')
      .insert({
        state: state,
        order_num: orderNum,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
      })

    if (stateError) {
      console.error('Erreur stockage state OAuth:', stateError)
      throw new Error('Erreur initialisation OAuth')
    }

    // Générer l'URL d'autorisation OAuth
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid offline_access edg-xp-mealdelivery-api',
      acr_values: 'tenant:fr-ctrtku',
      state: state // Token CSRF aléatoire
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
