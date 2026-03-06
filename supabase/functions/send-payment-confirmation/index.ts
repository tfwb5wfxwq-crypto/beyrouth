// Edge Function: Envoyer email immédiat après paiement confirmé
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

    // Vérifier que la commande est payée
    if (order.statut !== 'payee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas encore payée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.payment_email_sent_at) {
      console.log(`⏭️  Email de paiement déjà envoyé pour ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater l'heure de retrait
    const heureRetrait = order.heure_retrait || 'dès que possible'

    // Template email simple et rassurant
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
            <td style="padding:40px 40px 20px; text-align:center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius:12px 12px 0 0;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700;">
                ✅ Paiement confirmé !
              </h1>
            </td>
          </tr>

          <!-- Message principal -->
          <tr>
            <td style="padding:40px; text-align:center;">
              <p style="margin:0 0 20px; font-size:18px; color:#333; line-height:1.6;">
                Bonjour ${order.client_prenom},
              </p>
              <p style="margin:0 0 20px; font-size:16px; color:#666; line-height:1.6;">
                Nous avons bien reçu votre paiement de <strong style="color:#10b981;">${(order.total / 100).toFixed(2)}€</strong>.
              </p>
              <p style="margin:0 0 30px; font-size:16px; color:#666; line-height:1.6;">
                Votre commande <strong style="color:#f97316;">${order.numero}</strong> est en cours de validation par notre équipe.
              </p>

              <!-- Info commande -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px; background-color:#f0fdf4; border-left:4px solid #10b981; border-radius:6px;">
                    <p style="margin:0 0 10px; font-size:16px; color:#065f46; font-weight:600;">
                      📦 Votre commande
                    </p>
                    <p style="margin:0; font-size:14px; color:#065f46; line-height:1.6;">
                      Numéro : <strong>${order.numero}</strong><br>
                      Retrait prévu : <strong>${heureRetrait}</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:30px 0 0; font-size:14px; color:#888; line-height:1.6;">
                ⏳ Vous recevrez un second email dès que votre commande sera validée avec tous les détails.
              </p>
            </td>
          </tr>

          <!-- Adresse restaurant -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px; background-color:#f8f9ff; border-radius:8px; text-align:center;">
                    <h3 style="margin:0 0 15px; font-size:18px; color:#333;">
                      📍 Restaurant A Beyrouth
                    </h3>
                    <p style="margin:0; font-size:16px; color:#666; line-height:1.6;">
                      4 Esplanade du Général de Gaulle<br>
                      92400 Courbevoie
                    </p>
                    <p style="margin:15px 0 0; font-size:14px; color:#888;">
                      Métro : La Défense - Sortie 4
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
                Merci pour votre confiance ! 🙏
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer legal -->
        <table width="600" cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td style="text-align:center; padding:20px; font-size:12px; color:#999;">
              <p style="margin:0;">
                Beyrouth Express - Restaurant A Beyrouth<br>
                4 Esplanade du Général de Gaulle, 92400 Courbevoie (La Défense)
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
        subject: `✅ Paiement confirmé - Commande ${order.numero}`,
        html: emailHtml
      })
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Erreur envoi email:', emailResult)
      throw new Error('Erreur envoi email')
    }

    // Marquer l'email comme envoyé
    await supabase
      .from('orders')
      .update({ payment_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)

    console.log(`✅ Email de paiement confirmé envoyé pour ${order.numero}`)

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-payment-confirmation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
