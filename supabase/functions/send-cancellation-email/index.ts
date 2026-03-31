// Edge Function: Envoyer email d'annulation et remboursement
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaBrevo } from '../_shared/brevo-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔒 SÉCURITÉ: Validation token admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token admin requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier que le token existe en BDD et n'est pas expiré
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      console.error('❌ Token invalide ou expiré')
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Token valide → Update last_activity
    await supabase
      .from('admin_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('token', adminToken)

    const { orderId, cancellationReason } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    // Template email (Gmail-compatible - tables, solid colors, no flex/gradient)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    .email-header-bg { background-color: #000000 !important; }
    .email-wrapper { background-color: #f5f5f5 !important; }
    .email-body { background-color: #ffffff !important; }
  </style>
  <title>Commande annulée</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;">

          <!-- Header fond noir avec logo -->
          <tr>
            <td class="email-header-bg" style="background:#000000;padding:8px 24px;text-align:center;">
              <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding:24px 20px;">

              <!-- Alerte annulation -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fef2f2;padding:16px 20px;">
                    <span style="font-size:16px;font-weight:600;color:#991b1b;">❌ Commande annulée</span>
                  </td>
                </tr>
              </table>

              <!-- Numéro -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">Commande</div>
                    <div style="font-size:22px;font-weight:700;font-family:'Courier New',monospace;color:#ef4444;">${order.numero}</div>
                  </td>
                </tr>
              </table>

              ${cancellationReason ? `
              <!-- Raison -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">Raison</div>
                    <div style="font-size:14px;color:#666;line-height:1.6;">${cancellationReason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Remboursement -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fef3c7;padding:16px 20px;">
                    <div style="font-size:14px;font-weight:600;color:#92400e;margin-bottom:6px;">💳 Remboursement automatique</div>
                    <div style="font-size:13px;color:#78350f;line-height:1.5;">Le montant de <strong>${parseFloat(order.total).toFixed(2).replace('.', ',')} €</strong> vous sera remboursé sous 5 à 7 jours ouvrés.</div>
                  </td>
                </tr>
              </table>

              <!-- Contact -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e0e0e0;">
                <tr>
                  <td style="padding:16px 0;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">📍 Contact</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.5;margin-bottom:12px;">
                      <strong>A Beyrouth</strong> · 4 Esp. Gal de Gaulle<br>
                      92400 Courbevoie (La Défense)<br>
                      <span style="font-size:12px;color:#888;">Sortie 4 du métro La Défense</span>
                    </div>
                    <a href="https://www.google.com/maps/search/A+Beyrouth+4+Esplanade+du+General+de+Gaulle+92400+Courbevoie" target="_blank" style="display:inline-block;background:#E65100;color:#fff;text-decoration:none;padding:9px 20px;border-radius:7px;font-weight:600;font-size:13px;">
                      📍 Ouvrir dans Google Maps
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer avec CTA Google -->
          <tr>
            <td style="background:#fafafa;padding:32px 24px;border-top:1px solid #e0e0e0;">

              <!-- CTA Google -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#E3F2FD;border-radius:10px;padding:20px;text-align:center;">
                    <div style="font-size:20px;margin-bottom:6px;">⭐⭐⭐⭐⭐</div>
                    <div style="font-size:14px;font-weight:700;color:#1565C0;margin-bottom:4px;">Votre avis compte !</div>
                    <div style="font-size:12px;color:#1976D2;margin-bottom:14px;line-height:1.4;">Mettez-nous 5 étoiles sur Google 🙏</div>
                    <a href="https://maps.app.goo.gl/mKChLAAquBDL2C5c6" target="_blank" style="display:inline-block;background:#1976D2;color:#fff;text-decoration:none;padding:10px 22px;border-radius:7px;font-weight:600;font-size:13px;">
                      🌟 Laisser un avis
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instagram -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center" style="font-size:12px;color:#aaa;letter-spacing:0.5px;text-transform:uppercase;padding-bottom:8px;">Retrouvez-nous sur</td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://www.instagram.com/a_beyrouth/" target="_blank" style="display:inline-block;background:#fafafa;color:#1a1a1a;text-decoration:none;padding:10px 28px;border-radius:20px;font-weight:600;font-size:14px;border:1px solid #e0e0e0;letter-spacing:0.3px;">
                      @a_beyrouth
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Adresse -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;font-size:13px;color:#888;line-height:1.6;">
                    <strong style="color:#1a1a1a;">A Beyrouth</strong> · 4 Esp. Gal de Gaulle, 92400 Courbevoie<br>
                    <a href="https://beyrouth.express" style="color:#D4A853;text-decoration:none;">beyrouth.express</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Envoyer l'email via Brevo API
    const emailResult = await sendEmailViaBrevo({
      to: order.client_email,
      subject: `❌ Commande ${order.numero} annulée - Remboursement en cours`,
      html: emailHtml,
      replyTo: 'contact@beyrouth.express',
      orderId: orderId
    })

    if (!emailResult.success) {
      console.error('Erreur envoi email:', emailResult.error)
      throw new Error('Erreur envoi email')
    }

    // Marquer l'email comme envoyé + sauvegarder la raison
    await supabase
      .from('orders')
      .update({
        cancellation_email_sent_at: new Date().toISOString(),
        cancellation_reason: cancellationReason || null
      })
      .eq('id', orderId)

    console.log(`✅ Email d'annulation envoyé pour ${order.numero}`)

    // Remboursement automatique PayGreen (seulement si pas Edenred)
    let refundResult = null
    if (order.paygreen_transaction_id && order.total > 0 && order.edenred_status !== 'captured') {
      try {
        console.log(`💳 Remboursement de ${(order.total / 100).toFixed(2)}€ pour ${order.numero}...`)

        // Étape 1: Obtenir un JWT token PayGreen
        const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY')
        const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID')

        const authResponse = await fetch(`https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`, {
          method: 'POST',
          headers: {
            'Authorization': PAYGREEN_SECRET_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })

        if (!authResponse.ok) {
          throw new Error(`Auth PayGreen échouée: ${authResponse.status}`)
        }

        const authData = await authResponse.json()
        const jwtToken = authData.data?.token || authData.token

        if (!jwtToken) {
          throw new Error('JWT token non reçu de PayGreen')
        }

        // Étape 2: Créer le remboursement
        const refundResponse = await fetch(
          `https://api.paygreen.fr/payment/payment-orders/${order.paygreen_transaction_id}/refunds`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              amount: order.total, // En centimes
              reason: 'customer_request'
            })
          }
        )

        if (!refundResponse.ok) {
          const errorText = await refundResponse.text()
          throw new Error(`Remboursement échoué (${refundResponse.status}): ${errorText}`)
        }

        const refundData = await refundResponse.json()
        const refund = refundData.data || refundData

        refundResult = {
          refund_transaction_id: refund.id,
          refund_amount: order.total,
          refund_requested_at: new Date().toISOString(),
          refund_completed_at: new Date().toISOString(),
          refund_error: null
        }

        console.log(`✅ Remboursement réussi pour ${order.numero}: ${refund.id}`)

      } catch (refundError) {
        console.error(`❌ Erreur remboursement pour ${order.numero}:`, refundError)

        refundResult = {
          refund_requested_at: new Date().toISOString(),
          refund_error: refundError.message
        }

        // Ne pas bloquer l'email si le remboursement échoue
        // L'admin devra le faire manuellement
      }

      // Sauvegarder le résultat du remboursement
      await supabase
        .from('orders')
        .update(refundResult)
        .eq('id', orderId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund: refundResult ? {
          success: !refundResult.refund_error,
          transactionId: refundResult.refund_transaction_id,
          error: refundResult.refund_error
        } : null
      }),
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
