// Moniteur de commandes bloquées — tourne toutes les 2 min via pg_cron
// Filet de sécurité si le webhook PayGreen échoue pour n'importe quelle raison
// Le client peut fermer son téléphone : cette fonction rattrapera le coup
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID') ?? ''
const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY') ?? ''

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

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Commandes pending avec un ID PayGreen, créées il y a plus de 2 min
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const { data: pendingOrders, error } = await supabase
      .from('orders')
      .select('id, numero, statut, paygreen_transaction_id, total, heure_retrait, items, note')
      .eq('statut', 'pending')
      .not('paygreen_transaction_id', 'is', null)
      .lt('created_at', twoMinutesAgo)

    if (error) throw error

    if (!pendingOrders || pendingOrders.length === 0) {
      // Cas normal : rien à faire
      return new Response(JSON.stringify({ checked: 0, updated: 0 }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`🔍 Monitor: ${pendingOrders.length} commande(s) bloquée(s) détectée(s)`)

    // Auth PayGreen une seule fois pour toutes les commandes
    let jwt: string
    try {
      jwt = await getPaygreenJWT()
    } catch (e) {
      console.error('❌ Auth PayGreen impossible:', e)
      return new Response(JSON.stringify({ error: 'PayGreen auth failed' }), {
        status: 502, headers: { 'Content-Type': 'application/json' }
      })
    }

    // Auto-accept setting
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()
    const autoAccept = autoAcceptSetting?.value === 'true'

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    let updated = 0

    for (const order of pendingOrders) {
      try {
        const pgRes = await fetch(`https://api.paygreen.fr/payment/payment-orders/${order.paygreen_transaction_id}`, {
          headers: { 'Authorization': `Bearer ${jwt}`, 'Accept': 'application/json' }
        })

        if (!pgRes.ok) {
          console.warn(`⚠️ PayGreen lookup failed for ${order.numero}: ${pgRes.status}`)
          continue
        }

        const pgData = await pgRes.json()
        const pgStatus = pgData.data?.status ?? ''

        // Mapping statut
        let newStatus = 'pending'
        if (pgStatus.includes('successed') || pgStatus.includes('success') || pgStatus.includes('paid')) {
          newStatus = autoAccept ? 'acceptee' : 'payee'
        } else if (pgStatus.includes('refused') || pgStatus.includes('cancelled') || pgStatus.includes('expired')) {
          newStatus = 'cancelled'
        }

        if (newStatus === 'pending') continue // Genuinement en attente, on laisse

        const isPaid = newStatus === 'payee' || newStatus === 'acceptee'
        const now = new Date().toISOString()

        const { error: updateErr } = await supabase
          .from('orders')
          .update({
            statut: newStatus,
            paygreen_status: pgStatus,
            payment_confirmed_at: isPaid ? now : null
          })
          .eq('id', order.id)

        if (updateErr) {
          console.error(`❌ Update failed for ${order.numero}:`, updateErr)
          continue
        }

        updated++
        console.log(`✅ Monitor: ${order.numero} → ${newStatus} (PayGreen: ${pgStatus})`)

        // Notifications si paiement confirmé
        if (isPaid) {
          const emailFn = newStatus === 'acceptee' ? 'send-order-confirmation' : 'send-payment-confirmation'

          await Promise.allSettled([
            // Email client
            fetch(`${supabaseUrl}/functions/v1/${emailFn}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: order.id })
            }),
            // Notif Paco — normale, sans mention du cron
            fetch(`${supabaseUrl}/functions/v1/send-telegram-notification`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderNumber: order.numero,
                pickupTime: order.heure_retrait || 'Dès que possible',
                total: (order.total || 0).toFixed(2),
                paymentMethod: 'paygreen',
                items: order.items || [],
                note: order.note || null
              })
            })
          ])

          // Alerte technique séparée — webhook ET fallback manqués, rattrapé par cron
          try {
            const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
            const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
            if (botToken && chatId) {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `🚨 *ALERTE SYSTÈME*\nCommande \`${order.numero}\` — webhook PayGreen raté + fallback raté\n✅ Rattrapée par le moniteur cron (2 min)\n→ Paco a bien reçu sa notif`,
                  parse_mode: 'Markdown'
                })
              })
            }
          } catch (e) {
            console.error('Erreur alerte système Telegram:', e)
          }
        }
      } catch (e) {
        console.error(`❌ Erreur traitement ${order.numero}:`, e)
      }
    }

    return new Response(JSON.stringify({ checked: pendingOrders.length, updated }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erreur monitor-pending-orders:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
})
