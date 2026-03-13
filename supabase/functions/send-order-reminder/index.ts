// Edge Function: Envoyer email de relance si client n'est pas venu
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande complète
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Erreur récupération commande:', orderError)
      throw new Error('Commande introuvable')
    }

    // Vérifier que la commande est acceptée
    if (order.statut !== 'acceptee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas acceptée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater l'heure de retrait
    const pickupText = order.heure_retrait || 'Dès que possible'

    // Template email (design sobre)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre commande vous attend - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">

    <!-- Header sobre -->
    <div style="padding: 32px 24px; border-bottom: 1px solid #e0e0e0; text-align: center;">
      <div style="display: inline-flex; align-items: center; gap: 12px;"><img src="https://beyrouth.express/img/logo-olives.svg" alt="Falafels" style="height: 50px; width: auto; vertical-align: middle;"><img src="https://beyrouth.express/img/logo-text.svg" alt="Beyrouth Express" style="height: 45px; width: auto; vertical-align: middle;"></div>
      <div style="font-size: 13px; color: #666; margin-top: 12px;">Click <div style="font-size: 13px; color: #666; margin-top: 4px;">Click & Collect · A Beyrouth</div> Collect · Restaurant Libanais La Défense</div>
    </div>

    <!-- Titre principal -->
    <div style="padding: 32px 24px 24px 24px;">
      <div style="font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">Votre commande vous attend</div>
      <div style="font-size: 14px; color: #666; line-height: 1.5;">Rappel : votre commande est prête au retrait.</div>
    </div>

    <!-- Info principale -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background: #fafafa; border-left: 3px solid #D4A853; padding: 16px 20px; border-radius: 2px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Numéro de commande</div>
        <div style="font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; color: #1a1a1a; letter-spacing: 2px;">${order.numero}</div>
      </div>
    </div>

    <!-- Adresse retrait -->
    <div style="padding: 0 24px 32px 24px;">
      <div style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Lieu de retrait</div>
      <div style="font-size: 14px; color: #1a1a1a; line-height: 1.6; margin-bottom: 8px;">
        <strong>A Beyrouth</strong><br>
        4 Esplanade du Général de Gaulle<br>
        92400 Courbevoie (La Défense)
      </div>
      <a href="https://maps.google.com/?q=4+Esplanade+du+Général+de+Gaulle+92400+Courbevoie" style="font-size: 14px; color: #D4A853; text-decoration: none; font-weight: 500;">→ Voir sur Google Maps</a>
    </div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 24px; border-top: 1px solid #e0e0e0; text-align: center;">
      <div style="font-size: 12px; color: #888; line-height: 1.6;">
        À bientôt chez A Beyrouth<br>
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; margin-top: 8px; display: inline-block;">beyrouth.express</a>
      </div>
    </div>

  </div>
</body>
</html>
    `

    // Envoyer l'email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'Beyrouth Express <noreply@beyrouth.express>',
        to: order.client_email,
        subject: `⏰ ${order.numero} - Votre commande vous attend !`,
        html: emailHtml
      })
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Erreur envoi email:', emailResult)
      throw new Error('Erreur envoi email')
    }

    console.log(`✅ Email de relance envoyé pour ${order.numero}`)

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-order-reminder:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
