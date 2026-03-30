// Supabase Edge Function: Remboursement Edenred
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// URLs Edenred PRODUCTION
const EDENRED_REFUND_URL = 'https://directpayment.eu.edenred.io/v2/transactions'

// CORS permissif pour beyrouth.express (avec et sans www)
const allowedOrigins = ['https://beyrouth.express', 'https://www.beyrouth.express']

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier que le token existe en BDD et n'est pas expiré
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      console.error('❌ Token invalide ou expiré')
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Token valide → Update last_activity
    await supabase
      .from('admin_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('token', adminToken)

    const { captureId, amount } = await req.json()

    // Validation params
    if (!captureId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (captureId, amount requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Remboursement Edenred: ${captureId}, montant: ${amount} centimes`)

    // Récupérer credentials depuis Supabase Secrets
    const paymentClientId = Deno.env.get('EDENRED_PAYMENT_CLIENT_ID') ?? ''
    const paymentClientSecret = Deno.env.get('EDENRED_PAYMENT_CLIENT_SECRET') ?? ''

    if (!paymentClientId || !paymentClientSecret) {
      throw new Error('Credentials Edenred manquants')
    }

    // Créer timestamp ISO 8601 pour idempotence
    const tstamp = new Date().toISOString()

    // Appeler API Edenred pour remboursement
    const refundResponse = await fetch(`${EDENRED_REFUND_URL}/${captureId}/actions/refund`, {
      method: 'POST',
      headers: {
        'X-Client-Id': paymentClientId,
        'X-Client-Secret': paymentClientSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        amount: amount, // En centimes
        capture_mode: 'auto',
        tstamp: tstamp
      })
    })

    if (!refundResponse.ok) {
      const errorText = await refundResponse.text()
      console.error('❌ Erreur remboursement Edenred:', refundResponse.status, errorText)

      let edenredError = errorText
      try {
        const errorJson = JSON.parse(errorText)
        edenredError = errorJson.message || errorJson.error || errorText
      } catch (e) {}

      return new Response(
        JSON.stringify({
          error: `Échec remboursement Edenred (${refundResponse.status}): ${edenredError}`
        }),
        {
          status: refundResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const refundData = await refundResponse.json()
    console.log('✅ Remboursement Edenred effectué:', JSON.stringify(refundData))

    // Vérifier le statut de la réponse
    if (refundData.meta?.status !== 'succeeded') {
      console.error('❌ Remboursement Edenred échoué:', refundData)
      return new Response(
        JSON.stringify({
          error: 'Remboursement Edenred échoué',
          details: refundData.meta?.messages || refundData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mettre à jour la commande pour tracker le remboursement
    // (réutilise le client supabase déjà créé en ligne 38)

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        edenred_status: 'refunded',
        refunded_at: new Date().toISOString()
      })
      .eq('edenred_payment_id', captureId)

    if (updateError) {
      console.error('⚠️  Remboursement OK mais erreur mise à jour BDD:', updateError)
      // Ne pas bloquer le remboursement si l'update échoue
    }

    return new Response(
      JSON.stringify({
        success: true,
        captureId: captureId,
        amount: amount,
        status: 'refunded',
        refundData: refundData.data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur remboursement Edenred:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
