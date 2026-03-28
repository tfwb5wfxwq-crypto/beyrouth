// Edge Function: Annuler commande + Remboursement auto (PayGreen ou Edenred)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaBrevo } from '../_shared/brevo-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔒 FIX #75: Helper pour fetch avec timeout (évite hang infini si API externe down)
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Timeout API externe (${timeoutMs}ms)`)
    }
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔒 SÉCURITÉ: Validation token admin avec table admin_sessions
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Tentative accès sans token')
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token admin requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    // Connexion avec service_role_key (bypass RLS)
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
      console.error('❌ Token invalide ou expiré:', adminToken.substring(0, 8) + '...')
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

    const { orderId, reason } = await req.json()

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ error: 'orderId et reason requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // supabase client déjà créé dans le bloc de validation au-dessus

    // 1. Récupérer la commande
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      throw new Error('Commande introuvable')
    }

    console.log(`🔄 Annulation commande ${order.numero}...`)

    // 2. Déterminer le mode de paiement et rembourser
    let refundSuccess = false
    let refundError = null
    const debugLogs: string[] = [] // Logs pour debug

    if (order.paygreen_transaction_id) {
      // REMBOURSEMENT PAYGREEN
      debugLogs.push('💳 Remboursement PayGreen: ' + order.paygreen_transaction_id)

      try {
        // Étape 1: Obtenir JWT token PayGreen
        const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY')
        const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID')

        debugLogs.push(`🔑 SECRET_KEY: ${PAYGREEN_SECRET_KEY ? PAYGREEN_SECRET_KEY.substring(0, 10) + '...' : 'UNDEFINED'}`)
        debugLogs.push(`🏪 SHOP_ID: ${PAYGREEN_SHOP_ID || 'UNDEFINED'}`)
        debugLogs.push(`💳 Payment Order ID: ${order.paygreen_transaction_id}`)

        console.log(debugLogs.join('\n'))

        const authUrl = `https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`
        debugLogs.push(`🔗 Auth URL: ${authUrl}`)

        const authResponse = await fetchWithTimeout(
          authUrl,
          {
            method: 'POST',
            headers: {
              'Authorization': PAYGREEN_SECRET_KEY,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          },
          10000
        )

        debugLogs.push(`📊 Auth Status: ${authResponse.status}`)

        if (!authResponse.ok) {
          debugLogs.push(`❌ Auth échouée`)
          console.log(debugLogs.join('\n'))
          throw new Error(`Auth PayGreen échouée: ${authResponse.status}`)
        }

        const authData = await authResponse.json()
        const jwtToken = authData.data?.token || authData.token

        if (!jwtToken) {
          debugLogs.push(`❌ JWT non reçu`)
          console.log(debugLogs.join('\n'))
          throw new Error('JWT token non reçu de PayGreen')
        }

        debugLogs.push(`✅ JWT reçu: ${jwtToken.substring(0, 20)}...`)

        debugLogs.push(`💳 Tentative remboursement PayGreen: ${order.paygreen_transaction_id}`)

        // Étape 2: Refund direct (simplifié - comme fonction de test qui marche)
        const refundUrl = `https://api.paygreen.fr/payment/payment-orders/${order.paygreen_transaction_id}/refund`
        debugLogs.push(`🔄 Refund URL: ${refundUrl}`)

        console.log(debugLogs.join('\n'))

        const refundResponse = await fetchWithTimeout(
          refundUrl,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({}) // Body vide = refund complet (comme test qui marche)
          },
          10000
        )

        debugLogs.push(`📊 Refund Status: ${refundResponse.status}`)

        if (!refundResponse.ok) {
          const errorText = await refundResponse.text()
          debugLogs.push(`❌ Refund échoué: ${errorText}`)
          console.log(debugLogs.join('\n'))
          throw new Error(`Refund échoué (${refundResponse.status}): ${errorText}`)
        }

        debugLogs.push('✅ Remboursement réussi')
        console.log(debugLogs.join('\n'))

        const refundData = await refundResponse.json()
        const refund = refundData.data || refundData

        await supabase.from('orders').update({
          refund_transaction_id: refund.id,
          refund_completed_at: new Date().toISOString(),
          refund_amount: order.total,
          refund_error: null
        }).eq('id', orderId)

        console.log('✅ Remboursement PayGreen OK:', refund.id)
        refundSuccess = true

      } catch (error) {
        console.error('❌ Erreur remboursement PayGreen:', error.message)
        refundError = error.message

        await supabase.from('orders').update({
          refund_requested_at: new Date().toISOString(),
          refund_error: error.message
        }).eq('id', orderId)
      }

    } else if (order.edenred_payment_id) {
      // REMBOURSEMENT EDENRED
      console.log('🎫 Remboursement Edenred:', order.edenred_payment_id)

      try {
        // Appeler l'Edge Function edenred-refund
        const refundResponse = await supabase.functions.invoke('edenred-refund', {
          body: {
            captureId: order.edenred_payment_id,
            amount: order.total
          }
        })

        if (refundResponse.error) {
          throw new Error(refundResponse.error.message || 'Erreur remboursement Edenred')
        }

        const refundData = refundResponse.data

        if (!refundData.success) {
          throw new Error(refundData.error || 'Remboursement Edenred échoué')
        }

        await supabase.from('orders').update({
          refund_transaction_id: refundData.captureId,
          refund_completed_at: new Date().toISOString(),
          refund_amount: order.total,
          refund_error: null
        }).eq('id', orderId)

        console.log('✅ Remboursement Edenred OK:', refundData.captureId)
        refundSuccess = true

      } catch (error) {
        console.error('❌ Erreur remboursement Edenred:', error.message)
        refundError = error.message

        await supabase.from('orders').update({
          refund_requested_at: new Date().toISOString(),
          refund_error: error.message
        }).eq('id', orderId)
      }

    } else {
      throw new Error('Aucune transaction de paiement trouvée')
    }

    // 3. Mettre à jour le statut de la commande
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        statut: 'cancelled',
        archived: true,
        note: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (updateError) throw updateError

    // 4. Envoyer email au client via Brevo
    try {
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Commande annulée</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">

    <!-- Header avec fond noir -->
    <div style="background: #000; padding: 40px 24px; text-align: center;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width: 240px; height: auto; max-width: 100%;">
    </div>

    <!-- Contenu -->
    <div style="padding: 32px 24px;">
      <div style="font-size: 22px; font-weight: 600; color: #dc2626; margin-bottom: 16px;">⚠️ Commande annulée</div>

      <div style="background: #fef2f2; border-left: 3px solid #dc2626; padding: 16px 20px; border-radius: 2px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #991b1b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Numéro de commande</div>
        <div style="font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace; color: #1a1a1a; letter-spacing: 2px;">${order.numero}</div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; color: #1a1a1a; line-height: 1.6;">
          Nous sommes désolés de vous informer que votre commande a été annulée.
        </div>
      </div>

      <div style="background: #fafafa; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 8px; font-weight: 600;">Raison :</div>
        <div style="font-size: 14px; color: #1a1a1a;">${reason}</div>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 16px 20px; border-radius: 8px;">
        <div style="font-size: 14px; color: #166534; line-height: 1.6;">
          <strong>💳 Remboursement :</strong><br>
          Votre paiement de <strong>${order.total.toFixed(2)}€</strong> sera remboursé sous 3 à 5 jours ouvrés.
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 24px; border-top: 1px solid #e0e0e0; text-align: center;">
      <div style="font-size: 12px; color: #888; line-height: 1.6;">
        Nous nous excusons pour ce désagrément.<br>
        Pour toute question : <a href="mailto:contact@beyrouth.express" style="color: #D4A853; text-decoration: none;">contact@beyrouth.express</a><br>
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; margin-top: 8px; display: inline-block;">beyrouth.express</a>
      </div>
    </div>

  </div>
</body>
</html>
      `

      const emailResult = await sendEmailViaBrevo({
        to: order.client_email,
        subject: `⚠️ Commande ${order.numero} annulée - Remboursement en cours`,
        html: emailHtml,
        replyTo: 'contact@beyrouth.express',
        orderId: orderId  // Pour sync auto du statut
      })

      if (emailResult.success) {
        console.log('✅ Email annulation envoyé via Brevo')
        await supabase.from('orders').update({
          cancellation_email_sent_at: new Date().toISOString()
        }).eq('id', orderId)
      } else {
        console.error('❌ Erreur envoi email:', emailResult.error)
      }

    } catch (emailError) {
      console.error('❌ Erreur email:', emailError)
      // Ne pas bloquer le process si email échoue
    }

    // 5. Réponse
    return new Response(
      JSON.stringify({
        success: refundSuccess,
        message: refundSuccess ? 'Commande annulée et remboursement initié' : 'Commande annulée mais erreur remboursement',
        refundError,
        debugLogs  // Logs détaillés pour debug (visible dans l'admin)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur cancel-and-refund:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
