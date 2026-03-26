// Edge Function: Envoyer email d'annulation et remboursement
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaGmail } from '../_shared/gmail-smtp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, cancellationReason } = await req.json()

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

    // Template email (design original noir et or)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande annulée - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
    <!-- Header -->
    <div style="background: #1a1a1a; padding: 40px 20px; text-align: center;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="Beyrouth Express" style="width: 300px; max-width: 100%; height: auto; display: block; margin: 0 auto 12px auto; border-radius: 12px;">
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 16px;">Annulation de commande</p>
    </div>

    <!-- Warning Badge -->
    <div style="text-align: center; padding: 30px 20px;">
      <div style="width: 80px; height: 80px; background: #FEE2E2; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: #ef4444;">⚠️</span>
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #1a1a1a;">Commande annulée</h2>
      <p style="margin: 0; color: #666; font-size: 14px;">Nous sommes désolés, votre commande a dû être annulée</p>
    </div>

    <!-- Order Number -->
    <div style="background: #FFF8F0; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
      <div>
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Numéro de commande</p>
        <p style="margin: 0; font-size: 48px; font-weight: 700; color: #ef4444; font-family: 'Courier New', monospace; letter-spacing: 8px;">${order.numero}</p>
      </div>
    </div>

    <!-- Info -->
    <div style="padding: 30px 20px; background: #fafafa;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Raison de l'annulation</h3>
      <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
        ${cancellationReason || 'Cette annulation peut être due à un problème de disponibilité ou une erreur technique. Nous nous excusons sincèrement pour ce désagrément.'}
      </p>
    </div>

    <!-- Refund Info -->
    <div style="padding: 30px 20px;">
      <div style="background: #FFF8F0; padding: 20px; border-left: 4px solid #D4A853; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">💳 Remboursement automatique</p>
        <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.5;">
          Le montant de <strong>${(order.total / 100).toFixed(2).replace('.', ',')} €</strong> vous sera remboursé sous 5 à 7 jours ouvrés sur votre moyen de paiement initial.
        </p>
      </div>
    </div>

    <!-- Contact -->
    <div style="padding: 0 20px 30px 20px;">
      <div style="background: #fafafa; padding: 20px; border-radius: 4px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Pour toute question, contactez-nous :</p>
        <p style="margin: 0; font-size: 14px; color: #1a1a1a;">
          📍 4 Esplanade du Général de Gaulle, 92400 Courbevoie<br>
          <span style="font-size: 13px; color: #888;">Métro : La Défense - Sortie 4</span>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #1a1a1a; padding: 30px 20px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.6); font-size: 13px;">Toutes nos excuses pour ce désagrément</p>
      <p style="margin: 0; color: rgba(255,255,255,0.4); font-size: 12px;">4 Esplanade du Général de Gaulle, 92400 Courbevoie</p>
      <div style="margin-top: 20px;">
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; font-size: 13px;">beyrouth.express</a>
      </div>
    </div>
  </div>
</body>
</html>
    `

    // Envoyer l'email via Gmail SMTP
    const emailResult = await sendEmailViaGmail({
      to: order.client_email,
      subject: `❌ Commande ${order.numero} annulée - Remboursement en cours`,
      html: emailHtml,
      replyTo: 'contact@beyrouth.express'
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
