// Edge Function: Envoyer email d'annulation et remboursement
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

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Erreur récupération commande:', orderError)
      throw new Error('Commande introuvable')
    }

    // Vérifier que la commande est annulée
    if (order.statut !== 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Commande pas annulée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.cancellation_email_sent_at) {
      console.log(`⏭️  Email d'annulation déjà envoyé pour ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
            <td style="padding:40px 40px 20px; text-align:center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius:12px 12px 0 0;">
              <h1 style="margin:0; color:#ffffff; font-size:28px; font-weight:700;">
                Commande annulée
              </h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:40px; text-align:center;">
              <p style="margin:0 0 20px; font-size:18px; color:#333; line-height:1.6;">
                Bonjour ${order.client_prenom},
              </p>
              <p style="margin:0 0 20px; font-size:16px; color:#666; line-height:1.6;">
                Nous sommes désolés de vous informer que votre commande <strong style="color:#ef4444;">${order.numero}</strong> a dû être annulée.
              </p>
              <p style="margin:0 0 30px; font-size:16px; color:#666; line-height:1.6;">
                Cette annulation peut être due à un problème de disponibilité ou une erreur technique.
              </p>

              <!-- Remboursement -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px; background-color:#fef3c7; border-left:4px solid #f59e0b; border-radius:6px;">
                    <p style="margin:0 0 10px; font-size:16px; color:#92400e; font-weight:600;">
                      💳 Remboursement
                    </p>
                    <p style="margin:0; font-size:14px; color:#92400e; line-height:1.6;">
                      Le montant de <strong>${order.total.toFixed(2)}€</strong> vous sera remboursé sous 5 à 7 jours ouvrés sur votre moyen de paiement initial.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contact -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px; background-color:#f8f9ff; border-radius:8px; text-align:center;">
                    <p style="margin:0 0 15px; font-size:16px; color:#333;">
                      Pour toute question, n'hésitez pas à nous contacter :
                    </p>
                    <p style="margin:0; font-size:16px; color:#667eea; font-weight:600;">
                      📍 4 rue du Faubourg Poissonnière, 75010 Paris<br>
                      📞 01 XX XX XX XX (à ajouter)
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
                Toutes nos excuses pour ce désagrément 🙏
              </p>
              <p style="margin:0; font-size:14px; color:#888;">
                L'équipe Beyrouth Express
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
        subject: `❌ Commande ${order.numero} annulée - Remboursement en cours`,
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
      .update({ cancellation_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)

    console.log(`✅ Email d'annulation envoyé pour ${order.numero}`)

    // TODO: Gérer le remboursement via API PayGreen
    // Si order.paygreen_transaction_id existe, appeler l'API de remboursement

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-cancellation-email:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
