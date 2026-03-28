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

    // Template email (design équilibré)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande annulée</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">

    <!-- Header -->
    <div style="padding:24px 20px;text-align:center;border-bottom:1px solid #e0e0e0;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:180px;height:auto;margin:0 auto;">
    </div>

    <!-- Contenu principal -->
    <div style="padding:24px 20px;">

      <!-- Alerte annulation -->
      <div style="background:#fef2f2;border-left:3px solid #ef4444;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:600;color:#991b1b;">❌ Commande annulée</div>
      </div>

      <!-- Numéro -->
      <div style="background:#fafafa;padding:16px 20px;margin-bottom:20px;border-radius:6px;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">Commande</div>
        <div style="font-size:22px;font-weight:700;font-family:'Courier New',monospace;color:#ef4444;">${order.numero}</div>
      </div>

      ${cancellationReason ? `
      <!-- Raison -->
      <div style="background:#fafafa;padding:16px 20px;margin-bottom:20px;border-radius:6px;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">Raison</div>
        <div style="font-size:14px;color:#666;line-height:1.6;">${cancellationReason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
      ` : ''}

      <!-- Remboursement -->
      <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:14px;font-weight:600;color:#92400e;margin-bottom:6px;">💳 Remboursement automatique</div>
        <div style="font-size:13px;color:#78350f;line-height:1.5;">Le montant de <strong>${parseFloat(order.total).toFixed(2).replace('.', ',')} €</strong> vous sera remboursé sous 5 à 7 jours ouvrés.</div>
      </div>

      <!-- Contact -->
      <div style="padding:16px 0;border-top:1px solid #e0e0e0;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">📍 Contact</div>
        <div style="font-size:14px;color:#1a1a1a;line-height:1.5;">
          <strong>A Beyrouth</strong> · 4 Esp. Gal de Gaulle<br>
          92400 Courbevoie (La Défense)
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;">
      <a href="https://beyrouth.express" style="font-size:13px;color:#D4A853;text-decoration:none;">beyrouth.express</a>
    </div>

  </div>
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

    // Remboursement automatique PayGreen
    let refundResult = null
    if (order.paygreen_transaction_id && order.total > 0) {
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
