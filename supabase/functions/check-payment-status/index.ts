// Edge Function : Vérifie le statut d'un paiement PayGreen directement
// Utilisé comme fallback quand le webhook échoue (HMAC, timeout, etc.)
// Appelé par confirmation.html après ~20s de statut "pending"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID') ?? ''
const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY') ?? ''

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowed = ['https://beyrouth.express', 'https://www.beyrouth.express']
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'https://beyrouth.express',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

async function getPaygreenJWT(): Promise<string> {
  const res = await fetch(`https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`, {
    method: 'POST',
    headers: {
      'Authorization': PAYGREEN_SECRET_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
  })
  if (!res.ok) throw new Error(`PayGreen auth failed: ${res.status}`)
  const data = await res.json()
  return data.data?.token || data.token
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const orderNum = url.searchParams.get('num')

    if (!orderNum || orderNum.length < 4 || orderNum.length > 12) {
      return new Response(JSON.stringify({ error: 'Numéro invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande
    const { data: order } = await supabase
      .from('orders')
      .select('id, numero, statut, paygreen_transaction_id, payment_confirmed_at, total')
      .eq('numero', orderNum)
      .maybeSingle()

    if (!order) {
      return new Response(JSON.stringify({ error: 'Commande introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Si déjà mis à jour, retourner le statut actuel directement
    if (order.statut !== 'pending') {
      return new Response(JSON.stringify({ statut: order.statut, updated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Vérifier PayGreen si on a un transaction ID
    const pgRef = order.paygreen_transaction_id
    if (!pgRef) {
      return new Response(JSON.stringify({ statut: 'pending', updated: false, reason: 'no_pg_ref' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Authentification PayGreen
    let jwt: string
    try {
      jwt = await getPaygreenJWT()
    } catch (e) {
      console.error('Erreur auth PayGreen:', e)
      return new Response(JSON.stringify({ statut: 'pending', updated: false, reason: 'pg_auth_failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Récupérer le statut PayGreen
    const pgRes = await fetch(`https://api.paygreen.fr/payment/payment-orders/${pgRef}`, {
      headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' }
    })

    if (!pgRes.ok) {
      console.error('PayGreen lookup failed:', pgRes.status)
      return new Response(JSON.stringify({ statut: 'pending', updated: false, reason: 'pg_lookup_failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const pgData = await pgRes.json()
    const pgStatus = pgData.data?.status ?? ''

    console.log(`Order ${orderNum} — PayGreen status: ${pgStatus}`)

    // Mapping PayGreen → notre statut
    let newStatus = 'pending'
    if (pgStatus.includes('successed') || pgStatus.includes('success') || pgStatus.includes('paid')) {
      newStatus = 'payee'
    } else if (pgStatus.includes('refused') || pgStatus.includes('cancelled') || pgStatus.includes('expired')) {
      newStatus = 'cancelled'
    }

    if (newStatus === 'pending') {
      return new Response(JSON.stringify({ statut: 'pending', updated: false, pg_status: pgStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Vérifier auto-accept
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()
    const autoAccept = autoAcceptSetting?.value === 'true'

    // Statut final : si payee + auto-accept → acceptee directement
    const finalStatus = (newStatus === 'payee' && autoAccept) ? 'acceptee' : newStatus
    const now = new Date().toISOString()

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        statut: finalStatus,
        paygreen_status: pgStatus,
        payment_confirmed_at: newStatus === 'payee' ? now : null
      })
      .eq('id', order.id)

    if (updateErr) {
      console.error('Erreur update order:', updateErr)
      return new Response(JSON.stringify({ statut: 'pending', updated: false, reason: 'db_update_failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`✅ Fallback webhook: ${orderNum} → ${finalStatus} (pg: ${pgStatus})`)

    // Envoyer email si paiement confirmé
    if (newStatus === 'payee') {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const emailFn = finalStatus === 'acceptee' ? 'send-order-confirmation' : 'send-payment-confirmation'
      try {
        await fetch(`${supabaseUrl}/functions/v1/${emailFn}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id })
        })
      } catch (e) {
        console.error('Erreur envoi email:', e)
      }

      // Notification Telegram
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: orderNum,
            total: (order.total || 0).toFixed(2),
            paymentMethod: 'paygreen',
            note: '⚠️ Via fallback (webhook manqué)'
          })
        })
      } catch (e) {
        console.error('Erreur Telegram:', e)
      }
    }

    return new Response(JSON.stringify({ statut: finalStatus, updated: true, pg_status: pgStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erreur check-payment-status:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
