// Edge Function: Envoyer reçu de commande par email
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
    const { email, name, orderNum, items, total, pickup } = await req.json()

    // Validation
    if (!email || !orderNum || !items || !total) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resend API Key (à configurer dans Supabase Secrets)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY non configurée')
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Générer HTML du reçu
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">
          ${item.qty}x ${item.nom}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">
          ${(item.prix * item.qty).toFixed(2).replace('.', ',')} €
        </td>
      </tr>
    `).join('')

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
    <div style="background: #1A1A1A; color: white; padding: 32px 24px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">🧆</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 600;">A Beyrouth</h1>
      <p style="margin: 8px 0 0; opacity: 0.7; font-size: 14px;">Reçu de commande</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px 24px;">

      <!-- Confirmation -->
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: #E8F5EC; color: #1B8C3E; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">✓</div>
        <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600;">Commande confirmée</h2>
        <p style="margin: 0; color: #6B6B6B; font-size: 14px;">Numéro de commande</p>
        <p style="margin: 8px 0 0; font-size: 28px; font-weight: 700; color: #1A1A1A; letter-spacing: 1px;">${orderNum}</p>
      </div>

      <!-- Info Client -->
      <div style="background: #F7F7F5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #ABABAB;">Vos informations</p>
        <p style="margin: 0; font-size: 15px;"><strong>Nom :</strong> ${name}</p>
        <p style="margin: 8px 0 0; font-size: 15px;"><strong>Heure de retrait :</strong> ${pickup}</p>
        <p style="margin: 8px 0 0; font-size: 15px;"><strong>Lieu :</strong> La Défense — Sortie 4 Métro</p>
      </div>

      <!-- Items -->
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #ABABAB;">Détail de la commande</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0 0; font-weight: 600; font-size: 16px;">Total</td>
            <td style="padding: 16px 0 0; text-align: right; font-weight: 700; font-size: 18px;">${total.toFixed(2).replace('.', ',')} €</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align: center; padding: 24px 0;">
        <a href="https://beyrouth.express/commande.html?num=${orderNum}"
           style="display: inline-block; background: #1A1A1A; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Suivre ma commande
        </a>
      </div>

      <!-- Footer Info -->
      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #EAEAE8;">
        <p style="margin: 0; font-size: 13px; color: #6B6B6B;">On vous prévient quand c'est prêt !</p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #ABABAB;">En cas de question : contact@beyrouth.express</p>
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
        subject: `✅ Commande ${orderNum} confirmée — A Beyrouth`,
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
    console.error('Erreur send-receipt:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
