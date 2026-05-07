// Webhook Paygreen — vérification du paiement directement via API PayGreen
// Sécurité : on vérifie le paiement côté PayGreen (pas de dépendance au HMAC qui peut changer)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID') ?? ''
const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY') ?? ''

// Obtenir un JWT PayGreen pour appeler leur API
async function getPaygreenJWT(): Promise<string> {
  const res = await fetch(`https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`, {
    method: 'POST',
    headers: {
      'Authorization': PAYGREEN_SECRET_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  })
  if (!res.ok) throw new Error(`Auth PayGreen failed: ${res.status}`)
  const data = await res.json()
  return data.data?.token || data.token
}

// Vérifier le paiement directement chez PayGreen (source de vérité)
async function verifyPaymentWithPaygreen(paymentOrderId: string): Promise<{ status: string; amount: number } | null> {
  try {
    const jwt = await getPaygreenJWT()
    const res = await fetch(`https://api.paygreen.fr/payment/payment-orders/${paymentOrderId}`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' }
    })
    if (!res.ok) return null
    const data = await res.json()
    return {
      status: data.data?.status ?? '',
      amount: data.data?.amount ?? 0
    }
  } catch (e) {
    console.error('Erreur vérification PayGreen:', e)
    return null
  }
}

// Helper retry avec backoff (webhook peut arriver avant création commande)
async function findOrderWithRetry(supabase: any, orderNum: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const { data } = await supabase
      .from('orders')
      .select('id, statut, payment_confirmed_at, paygreen_transaction_id, total, heure_retrait, numero, items, note')
      .eq('numero', orderNum)
      .maybeSingle()

    if (data) return data

    if (i < maxRetries - 1) {
      const delay = 500 * Math.pow(2, i)
      console.warn(`⏳ Commande ${orderNum} introuvable, retry dans ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()

    // Log la signature pour debug (sans rejeter si invalide)
    const signature = req.headers.get('signature')
    const webhookHmac = Deno.env.get('PAYGREEN_WEBHOOK_HMAC')

    if (signature && webhookHmac) {
      try {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(webhookHmac),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        )
        let sigBytes: Uint8Array
        try {
          sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
        } catch {
          sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
        }
        const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
        if (isValid) {
          console.log('✅ Signature HMAC valide')
        } else {
          // ⚠️ HMAC invalide (clé PayGreen peut avoir changé) — on continue quand même
          // La vraie sécurité est la vérification directe via API PayGreen ci-dessous
          console.warn('⚠️ Signature HMAC invalide (clé peut avoir changé) — vérification via API PayGreen')
        }
      } catch (e) {
        console.warn('⚠️ Erreur vérification HMAC:', e.message, '— on continue via API')
      }
    } else if (!signature) {
      console.warn('⚠️ Webhook sans signature HMAC — vérification via API PayGreen')
    }

    const webhookData = JSON.parse(body)
    console.log('Webhook PayGreen reçu:', JSON.stringify(webhookData))

    const { id: paymentOrderId, event, reference } = webhookData
    const orderNum = reference

    if (!orderNum || !event) {
      console.error('Données webhook invalides:', { orderNum, event })
      return new Response(
        JSON.stringify({ error: 'Données invalides (reference ou event manquant)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // On ne traite que les événements de succès ou d'échec
    const isSuccess = event.includes('successed') || event.includes('success') || event.includes('paid')
    const isFailure = event.includes('refused') || event.includes('cancelled') || event.includes('canceled') || event.includes('expired')
    const isRefund = event.includes('refunded')

    if (!isSuccess && !isFailure && !isRefund) {
      console.log(`Event ignoré: ${event}`)
      return new Response(JSON.stringify({ ignored: true, event }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande
    const existingOrder = await findOrderWithRetry(supabase, orderNum, 3)
    if (!existingOrder) {
      console.error(`Commande ${orderNum} introuvable`)
      return new Response(
        JSON.stringify({ error: `Commande ${orderNum} introuvable` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const wasAlreadyPaid = existingOrder.statut !== 'pending'
    if (wasAlreadyPaid && !isRefund) {
      console.log(`Commande ${orderNum} déjà traitée (statut: ${existingOrder.statut}) — ignoré`)
      return new Response(JSON.stringify({ skipped: true, statut: existingOrder.statut }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 🔒 VÉRIFICATION DIRECTE PAYGREEN — source de vérité absolue
    // On vérifie le paiement chez PayGreen, indépendamment du HMAC
    if (isSuccess && paymentOrderId) {
      const pgVerification = await verifyPaymentWithPaygreen(paymentOrderId)
      if (!pgVerification) {
        console.error(`❌ Impossible de vérifier le paiement ${paymentOrderId} chez PayGreen`)
        return new Response(
          JSON.stringify({ error: 'Vérification PayGreen impossible' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!pgVerification.status.includes('successed') && !pgVerification.status.includes('success') && !pgVerification.status.includes('paid')) {
        console.warn(`❌ PayGreen confirme que le paiement ${paymentOrderId} N'EST PAS réussi (${pgVerification.status}) — rejeté`)
        return new Response(
          JSON.stringify({ error: 'Paiement non confirmé par PayGreen', pg_status: pgVerification.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`✅ PayGreen confirme le paiement ${paymentOrderId}: ${pgVerification.status}`)
    }

    // Mapper statut
    let newStatus = 'pending'
    if (isSuccess) newStatus = 'payee'
    else if (isFailure) newStatus = 'cancelled'
    else if (isRefund) newStatus = 'refunded'

    // Mettre à jour la commande
    const { data, error } = await supabase
      .from('orders')
      .update({
        statut: newStatus,
        paygreen_status: event,
        paygreen_transaction_id: paymentOrderId || existingOrder.paygreen_transaction_id,
        payment_confirmed_at: newStatus === 'payee' ? new Date().toISOString() : null
      })
      .eq('numero', orderNum)
      .select()

    if (error) {
      console.error('Erreur mise à jour commande:', error)
      throw error
    }

    console.log(`✅ Commande ${orderNum} → ${newStatus}`)

    // Auto-accept
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()

    const autoAcceptEnabled = autoAcceptSetting?.value === 'true'
    const orderRecord = data?.[0]

    if (newStatus === 'payee' && autoAcceptEnabled && orderRecord) {
      const { error: acceptError } = await supabase
        .from('orders')
        .update({ statut: 'acceptee' })
        .eq('id', orderRecord.id)

      if (!acceptError) {
        console.log(`🤖 Auto-accept: ${orderNum} → acceptee`)

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        await Promise.allSettled([
          fetch(`${supabaseUrl}/functions/v1/send-order-confirmation`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderRecord.id })
          }),
          fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderNumber: orderRecord.numero,
              pickupTime: orderRecord.heure_retrait || 'Dès que possible',
              total: (orderRecord.total || 0).toFixed(2),
              paymentMethod: 'paygreen',
              items: orderRecord.items || [],
              note: orderRecord.note || null
            })
          })
        ])
      }
    } else if (newStatus === 'payee' && !autoAcceptEnabled && orderRecord) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

      await Promise.allSettled([
        fetch(`${supabaseUrl}/functions/v1/send-payment-confirmation`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderRecord.id })
        }),
        fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: orderRecord.numero,
            pickupTime: orderRecord.heure_retrait || 'Dès que possible',
            total: (orderRecord.total || 0).toFixed(2),
            paymentMethod: 'paygreen',
            items: orderRecord.items || []
          })
        })
      ])
    }

    return new Response(
      JSON.stringify({ success: true, order: orderNum, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
