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

    // Template email (design original noir et or)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre commande vous attend - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #000 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: #D4A853; margin: 0 0 8px 0; font-size: 32px; font-weight: 700; letter-spacing: 1px;">Beyrouth Express</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 15px; line-height: 1.5;">Service Click and Collect<br>restaurant A Beyrouth</p>
    </div>

    <!-- Alert Badge -->
    <div style="text-align: center; padding: 30px 20px;">
      <div style="width: 80px; height: 80px; background: #FFF3E0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: #f97316;">⏰</span>
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #1a1a1a;">Votre commande vous attend !</h2>
      <p style="margin: 0; color: #666; font-size: 14px;">Bonjour ${order.client_prenom}, n'oubliez pas de récupérer votre commande</p>
    </div>

    <!-- Order Number -->
    <div style="background: #FFF8F0; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
      <div>
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Numéro de commande</p>
        <p style="margin: 0; font-size: 48px; font-weight: 700; color: #f97316; font-family: 'Courier New', monospace; letter-spacing: 8px;">${order.numero}</p>
        <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">Présentez ce numéro lors du retrait</p>
      </div>
    </div>

    <!-- Info -->
    <div style="padding: 30px 20px; background: #fafafa;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Informations de retrait</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Heure prévue :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${pickupText}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px; vertical-align: top;"><strong>Lieu :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px; line-height: 1.5;">
            4 Esplanade du Général de Gaulle<br>
            92400 Courbevoie (La Défense)<br>
            <a href="https://maps.google.com/?q=4+Esplanade+du+Général+de+Gaulle+92400+Courbevoie" style="color: #f97316; text-decoration: none; font-weight: 600;">📍 Voir sur Google Maps</a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="background: #1a1a1a; padding: 30px 20px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.6); font-size: 13px;">À très bientôt chez A Beyrouth !</p>
      <p style="margin: 0; color: rgba(255,255,255,0.4); font-size: 12px;">4 Esplanade du Général de Gaulle, 92400 Courbevoie</p>
      <div style="margin-top: 20px;">
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; font-size: 13px;">beyrouth.express</a>
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
