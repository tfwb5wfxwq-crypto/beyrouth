// Edge Function: Envoyer email de relance si client n'est pas venu
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
    const heureRetrait = order.heure_retrait || 'dès que possible'

    // Template email simple
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5; padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 20px; text-align:center; background: linear-gradient(135deg, #f97316 0%, #fb923c 100%); border-radius:12px 12px 0 0;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700;">
                ⏰ Votre commande vous attend !
              </h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:30px 40px; text-align:center;">
              <p style="margin:0 0 20px; font-size:18px; color:#333; line-height:1.6;">
                Bonjour ${order.client_prenom},
              </p>
              <p style="margin:0 0 20px; font-size:16px; color:#666; line-height:1.6;">
                Votre commande <strong style="color:#f97316;">${order.numero}</strong> est prête et vous attend au restaurant !
              </p>
              <p style="margin:0; font-size:16px; color:#666; line-height:1.6;">
                Heure de retrait prévue : <strong>${heureRetrait}</strong>
              </p>
            </td>
          </tr>

          <!-- Adresse restaurant -->
          <tr>
            <td style="padding:20px 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px; background-color:#f8f9ff; border-radius:8px; text-align:center;">
                    <h3 style="margin:0 0 15px; font-size:18px; color:#333;">
                      📍 Adresse
                    </h3>
                    <p style="margin:0; font-size:16px; color:#666; line-height:1.6;">
                      <strong>Beyrouth Express</strong><br>
                      4 rue du Faubourg Poissonnière<br>
                      75010 Paris
                    </p>
                    <p style="margin:15px 0 0; font-size:14px; color:#888;">
                      Métro : Bonne Nouvelle (lignes 8, 9)
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px; background-color:#f8f9ff; text-align:center; border-radius:0 0 12px 12px;">
              <p style="margin:0; font-size:14px; color:#888;">
                À très bientôt ! 🙏
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer legal -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td style="text-align:center; padding:20px; font-size:12px; color:#999;">
              <p style="margin:0;">
                Beyrouth Express - 4 rue du Faubourg Poissonnière, 75010 Paris
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
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
