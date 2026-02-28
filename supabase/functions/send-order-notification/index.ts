// Edge Function: Notifier le client que sa commande est prête
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, name, orderNum, codeRetrait, pickup } = await req.json()

    // Validation
    if (!email || !orderNum || !codeRetrait) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resend API Key
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée')
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f7f7f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1B8C3E 0%, #157A33 100%); color: white; padding: 40px 24px; text-align: center;">
      <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 600;">Commande acceptée !</h1>
      <p style="margin: 12px 0 0; opacity: 0.9; font-size: 16px;">En cours de préparation</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px 24px;">

      <!-- Code de retrait -->
      <div style="text-align: center; margin-bottom: 32px; padding: 32px 24px; background: linear-gradient(135deg, #E8F5EC 0%, #d4f1dc 100%); border-radius: 16px;">
        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #157A33;">Votre code de retrait</p>
        <p style="margin: 0; font-size: 56px; font-weight: 700; color: #1B8C3E; letter-spacing: 12px; line-height: 1;">${codeRetrait}</p>
        <p style="margin: 16px 0 0; font-size: 14px; color: #6B6B6B;">À présenter au comptoir</p>
      </div>

      <!-- Infos -->
      <div style="background: #F7F7F5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 24px;">📍</div>
          <div>
            <p style="margin: 0; font-size: 12px; color: #6B6B6B; font-weight: 500;">Lieu de retrait</p>
            <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #1A1A1A;">La Défense — Sortie 4 Métro</p>
          </div>
        </div>
        ${pickup ? `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 24px;">⏰</div>
          <div>
            <p style="margin: 0; font-size: 12px; color: #6B6B6B; font-weight: 500;">Sera prête pour</p>
            <p style="margin: 4px 0 0; font-size: 15px; font-weight: 600; color: #1A1A1A;">${pickup}</p>
          </div>
        </div>
        ` : ''}
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <a href="https://www.google.com/maps/search/A+Beyrouth+1+Esplanade+du+General+de+Gaulle+92800+Puteaux"
           style="display: inline-block; background: #1A1A1A; color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 600; font-size: 16px;">
          📍 Voir l'itinéraire
        </a>
      </div>

      <!-- Info -->
      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #EAEAE8;">
        <p style="margin: 0; font-size: 14px; color: #1B8C3E; font-weight: 600;">🍽️ On prépare votre commande avec soin</p>
        <p style="margin: 12px 0 0; font-size: 13px; color: #6B6B6B;">Commande ${orderNum}</p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #ABABAB;">Des questions ? contact@beyrouth.express</p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #1A1A1A; color: white; padding: 20px 24px; text-align: center; font-size: 12px; opacity: 0.6;">
      <p style="margin: 0;">A Beyrouth — Cuisine libanaise authentique</p>
      <p style="margin: 4px 0 0;">1 Esplanade du Général de Gaulle, 92800 Puteaux</p>
    </div>

  </div>
</body>
</html>
    `

    // Envoyer via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'A Beyrouth <commande@beyrouth.express>',
        to: [email],
        subject: `✅ Commande ${orderNum} acceptée — A Beyrouth`,
        html: emailHtml,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Erreur Resend:', error)
      return new Response(
        JSON.stringify({ error: 'Erreur envoi email', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erreur send-order-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
