// Supabase Edge Function: Remboursement PayGreen (sécurisé)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { transactionId, amount } = await req.json()

    // Validation params
    if (!transactionId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (transactionId, amount requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Remboursement PayGreen: ${transactionId}, montant: ${amount}€`)

    // Récupérer la clé secrète depuis Supabase Secrets (sécurisé)
    const paygreenSecretKey = Deno.env.get('PAYGREEN_SECRET_KEY')

    if (!paygreenSecretKey) {
      throw new Error('PAYGREEN_SECRET_KEY non configuré')
    }

    // Appeler API PayGreen pour remboursement
    const response = await fetch(`https://paygreen.fr/api/refund/${transactionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paygreenSecretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100) // Montant en centimes
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erreur remboursement PayGreen:', response.status, errorText)

      let errorMessage = errorText
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.message || errorJson.error || errorText
      } catch (e) {}

      return new Response(
        JSON.stringify({
          error: `Erreur remboursement PayGreen (${response.status}): ${errorMessage}`
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const refundData = await response.json()
    console.log('✅ Remboursement PayGreen effectué:', JSON.stringify(refundData))

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transactionId,
        amount: amount,
        refundData: refundData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur remboursement PayGreen:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
