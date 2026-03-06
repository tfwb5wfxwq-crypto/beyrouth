// Edge Function: Envoyer email de confirmation quand commande est acceptée
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

    // Vérifier que la commande est bien acceptée
    if (order.statut !== 'acceptee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas encore acceptée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.confirmation_email_sent_at) {
      console.log(`⏭️  Email de confirmation déjà envoyé pour commande ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construire le récapitulatif des items
    const itemsHtml = order.items.map((item: any) => {
      let html = `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #eee;">
            <strong>${item.nom}</strong>
          </td>
          <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">
            ${item.quantite}x ${item.prix.toFixed(2)}€
          </td>
        </tr>
      `

      // Ajouter les suppléments si présents
      if (item.supplements && item.supplements.length > 0) {
        item.supplements.forEach((supp: any) => {
          html += `
            <tr>
              <td style="padding:4px 0 4px 20px; border-bottom:1px solid #eee; font-size:14px; color:#666;">
                + ${supp.nom}
              </td>
              <td style="padding:4px 0; border-bottom:1px solid #eee; text-align:right; font-size:14px; color:#666;">
                ${supp.prix.toFixed(2)}€
              </td>
            </tr>
          `
        })
      }

      return html
    }).join('')

    // Formater l'heure de retrait
    const heureRetrait = order.heure_retrait || 'dès que possible'

    // Template email
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
            <td style="padding:40px 40px 20px; text-align:center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius:12px 12px 0 0;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700;">
                ✅ Commande confirmée !
              </h1>
            </td>
          </tr>

          <!-- Numéro de commande -->
          <tr>
            <td style="padding:30px 40px; text-align:center; background-color:#f8f9ff;">
              <p style="margin:0 0 10px; font-size:16px; color:#666;">Votre numéro de commande :</p>
              <div style="display:inline-block; background-color:#667eea; color:#ffffff; padding:15px 30px; border-radius:8px; font-size:32px; font-weight:700; letter-spacing:2px;">
                ${order.numero}
              </div>
              <p style="margin:15px 0 0; font-size:14px; color:#888;">
                Présentez ce numéro lors du retrait
              </p>
            </td>
          </tr>

          <!-- Heure de retrait -->
          <tr>
            <td style="padding:20px 40px; background-color:#fff;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:15px; background-color:#f0fdf4; border-left:4px solid #22c55e; border-radius:6px;">
                    <p style="margin:0; font-size:16px; color:#166534;">
                      <strong>🕐 Heure de retrait :</strong> ${heureRetrait}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Récapitulatif commande -->
          <tr>
            <td style="padding:20px 40px;">
              <h2 style="margin:0 0 20px; font-size:20px; color:#333; border-bottom:2px solid #667eea; padding-bottom:10px;">
                📋 Récapitulatif
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${itemsHtml}
                <tr>
                  <td style="padding:15px 0 0; font-size:18px; font-weight:700; color:#333;">
                    TOTAL
                  </td>
                  <td style="padding:15px 0 0; font-size:18px; font-weight:700; color:#667eea; text-align:right;">
                    ${order.total.toFixed(2)}€
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${order.note ? `
          <!-- Note -->
          <tr>
            <td style="padding:20px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:15px; background-color:#fef9c3; border-left:4px solid #eab308; border-radius:6px;">
                    <p style="margin:0; font-size:14px; color:#854d0e;">
                      <strong>📝 Votre note :</strong> ${order.note}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Adresse restaurant -->
          <tr>
            <td style="padding:20px 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px; background-color:#f8f9ff; border-radius:8px; text-align:center;">
                    <h3 style="margin:0 0 15px; font-size:18px; color:#333;">
                      📍 Adresse de retrait
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
              <p style="margin:0 0 10px; font-size:16px; color:#333;">
                Merci pour votre commande ! 🙏
              </p>
              <p style="margin:0; font-size:14px; color:#888;">
                À très bientôt chez Beyrouth Express
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
        subject: `✅ Commande ${order.numero} confirmée - À retirer à ${heureRetrait}`,
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
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)

    console.log(`✅ Email de confirmation envoyé pour ${order.numero}`)

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-order-ready:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
