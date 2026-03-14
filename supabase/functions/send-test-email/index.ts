// Edge Function: Envoyer email de test
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Template email test (même design que commande confirmée)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">

    <!-- Header avec logo -->
    <div style="padding: 32px 24px; border-bottom: 1px solid #e0e0e0; text-align: center;">
      <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; display: inline-block; margin-bottom: 12px;">
        <div style="display: inline-flex; align-items: center; gap: 12px;">
          <img src="https://beyrouth.express/img/logo-olives.svg" alt="Falafels" style="height: 50px; width: auto; vertical-align: middle;">
          <img src="https://beyrouth.express/img/logo-text.svg" alt="Beyrouth Express" style="height: 45px; width: auto; vertical-align: middle;">
        </div>
      </div>
      <div style="font-size: 13px; color: #666; margin-top: 12px;">Retrait · Restaurant Libanais La Défense</div>
    </div>

    <!-- Titre principal -->
    <div style="padding: 32px 24px 24px 24px;">
      <div style="font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">Email de test</div>
      <div style="font-size: 14px; color: #666; line-height: 1.5;">Ceci est un email de test pour vérifier le design et la délivrabilité.</div>
    </div>

    <!-- Info principale -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background: #fafafa; border-left: 3px solid #D4A853; padding: 16px 20px; border-radius: 2px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Numéro de test</div>
        <div style="font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; color: #1a1a1a; letter-spacing: 2px;">1234 AB</div>
      </div>
    </div>

    <!-- Récapitulatif exemple -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Exemple de commande</div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 12px 0; font-size: 14px; color: #1a1a1a;">2× Falafel</td>
          <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1a1a1a; font-weight: 500;">16.00€</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 12px 0; font-size: 14px; color: #1a1a1a;">1× Houmous</td>
          <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1a1a1a; font-weight: 500;">5.50€</td>
        </tr>
        <tr style="border-top: 1px solid #f0f0f0;">
          <td style="padding: 12px 0; font-size: 13px; color: #888;">Total HT</td>
          <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1a1a1a;">19.55€</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 8px 0; font-size: 13px; color: #888;">TVA 10%</td>
          <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #1a1a1a;">1.95€</td>
        </tr>
        <tr style="border-top: 2px solid #1a1a1a;">
          <td style="padding: 16px 0 0 0; font-size: 16px; color: #1a1a1a; font-weight: 600;">Total TTC</td>
          <td style="padding: 16px 0 0 0; text-align: right; font-size: 18px; color: #1a1a1a; font-weight: 700;">21.50€</td>
        </tr>
      </table>
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
        from: 'A Beyrouth <commande@beyrouth.express>',
        to: email,
        subject: '✅ Test Email - A Beyrouth',
        html: emailHtml,
        reply_to: 'contact@beyrouth.express'
      })
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Erreur envoi email:', emailResult)
      throw new Error('Erreur envoi email')
    }

    console.log(`✅ Email de test envoyé à ${email}`)

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-test-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
