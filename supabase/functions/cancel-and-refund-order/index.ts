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
    // 🔒 SÉCURITÉ : Vérifier authentification admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Tentative accès sans token')
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token admin requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    // Créer client Supabase avec le token admin pour validation
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    // Vérifier que le token est valide en tentant une opération admin
    const { data: adminCheck, error: authError } = await supabaseAuth
      .from('settings')
      .select('key')
      .limit(1)
      .maybeSingle()

    if (authError) {
      console.error('❌ Token admin invalide:', authError)
      return new Response(
        JSON.stringify({ error: 'Token admin invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { orderId, reason } = await req.json()

    if (!orderId || !reason) {
      return new Response(
        JSON.stringify({ error: 'orderId et reason requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    if (order.paygreen_transaction_id) {
      // REMBOURSEMENT PAYGREEN
      console.log('💳 Remboursement PayGreen:', order.paygreen_transaction_id)

      try {
        // Étape 1: Obtenir JWT token PayGreen
        const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY')
        const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID')

        const authResponse = await fetchWithTimeout(
          `https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`,
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

        if (!authResponse.ok) {
          throw new Error(`Auth PayGreen échouée: ${authResponse.status}`)
        }

        const authData = await authResponse.json()
        const jwtToken = authData.data?.token || authData.token

        if (!jwtToken) {
          throw new Error('JWT token non reçu de PayGreen')
        }

        // Étape 2: Créer le remboursement
        const refundResponse = await fetchWithTimeout(
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
          },
          10000
        )

        if (!refundResponse.ok) {
          const errorText = await refundResponse.text()
          throw new Error(`Remboursement échoué (${refundResponse.status}): ${errorText}`)
        }

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

      // TODO: Implémenter API Edenred refund quand disponible
      // Pour l'instant, marquer comme à rembourser manuellement
      console.warn('⚠️ Edenred refund API non disponible - remboursement manuel requis')

      await supabase.from('orders').update({
        refund_requested_at: new Date().toISOString(),
        refund_amount: order.total
      }).eq('id', orderId)

      refundSuccess = true // Considéré comme succès pour workflow
      refundError = 'Remboursement Edenred à traiter manuellement'

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

    <!-- Header -->
    <div style="padding: 32px 24px; border-bottom: 1px solid #e0e0e0; text-align: center;">
      <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; display: inline-block; margin-bottom: 12px;">
        <div style="display: inline-flex; align-items: center; gap: 12px;">
          <img src="https://beyrouth.express/img/logo-olives.svg" alt="Falafels" style="height: 50px;">
          <img src="https://beyrouth.express/img/logo-text.svg" alt="Beyrouth Express" style="height: 45px;">
        </div>
      </div>
      <div style="font-size: 13px; color: #666; margin-top: 12px;">Restaurant Libanais La Défense</div>
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
          Votre paiement de <strong>${(order.total / 100).toFixed(2)}€</strong> sera remboursé sous 3 à 5 jours ouvrés.
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
        refundError
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
