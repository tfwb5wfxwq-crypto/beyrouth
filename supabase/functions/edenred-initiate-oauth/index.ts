// Supabase Edge Function: Initier le flow OAuth Edenred - Génère l'URL d'autorisation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred PRODUCTION
const EDENRED_AUTHORIZE_URL = 'https://sso.edenred.io/connect/authorize'
const REDIRECT_URI = 'https://beyrouth.express/?edenred_oauth=1'

// CORS restreint à beyrouth.express
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Créer client Supabase pour stocker le state CSRF
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Générer un state aléatoire cryptographique pour protection CSRF
    const state = crypto.randomUUID()

    // Stocker le state en base avec le numéro de commande (expire dans 15 min)
    const { error: insertError } = await supabase
      .from('oauth_states')
      .insert({
        state: state,
        order_num: orderNum
      })

    if (insertError) {
      console.error('❌ Erreur stockage state CSRF:', insertError)
      throw new Error('Impossible de générer le token de sécurité')
    }

    console.log(`🔐 Token CSRF généré et stocké pour commande ${orderNum}`)

    // Générer l'URL d'autorisation OAuth avec le vrai state aléatoire
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid offline_access edg-xp-mealdelivery-api',
      acr_values: 'tenant:fr-ctrtku',
      state: state // Utilise le token CSRF aléatoire
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
