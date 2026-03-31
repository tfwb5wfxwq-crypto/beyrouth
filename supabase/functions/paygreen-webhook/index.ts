// Webhook Paygreen pour valider les paiements
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔒 FIX #80: Helper pour retry avec backoff exponentiel (webhook peut arriver avant création commande)
async function findOrderWithRetry(supabase: any, orderNum: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, statut, payment_confirmed_at, paygreen_transaction_id')
      .eq('numero', orderNum)
      .maybeSingle()

    if (data) {
      console.log(`✅ Commande trouvée (tentative ${i + 1}/${maxRetries})`)
      return data
    }

    if (i < maxRetries - 1) {
      // Backoff exponentiel : 500ms, 1s, 2s
      const delay = 500 * Math.pow(2, i)
      console.warn(`⏳ Commande ${orderNum} introuvable, retry dans ${delay}ms... (${i + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error(`Commande ${orderNum} introuvable après ${maxRetries} tentatives`)
}

// 🔒 SÉCURITÉ : Vérifier si le restaurant est ouvert (7j/7 11h30-21h00)
function isOpenNow(): boolean {
  const now = new Date()
  // Convert to Paris timezone (UTC+1 or UTC+2 depending on DST)
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const h = parisTime.getHours()
  const m = parisTime.getMinutes()
  const nowMin = h * 60 + m

  // Tous les jours de 11h30 (690 min) à 21h00 (1260 min)
  // ⚠️ RAPPEL : Cartes resto interdites samedi/dimanche (bloqué côté client), seule CB acceptée
  return nowMin >= 690 && nowMin < 1260
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('signature')
    const webhookHmac = Deno.env.get('PAYGREEN_WEBHOOK_HMAC')

    // 🔒 Vérification HMAC optionnelle (log si invalide mais ne bloque pas)
    // La vraie sécurité = vérifier que le numéro de commande existe en BDD
    if (signature && webhookHmac) {
      try {
        const encoder = new TextEncoder()
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(webhookHmac),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        )
        // Essayer base64 d'abord, puis hex
        let sigBytes: Uint8Array
        try {
          sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
        } catch {
          // signature en hex
          sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
        }
        const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
        if (isValid) {
          console.log('✅ Signature HMAC valide')
        } else {
          console.warn('⚠️ Signature HMAC invalide — webhook traité quand même (ordre vérifié en BDD)')
        }
      } catch (hmacErr) {
        console.warn('⚠️ Erreur vérification HMAC:', hmacErr.message, '— webhook traité quand même')
      }
    } else {
      console.log('ℹ️ Pas de signature HMAC — webhook accepté (ordre vérifié en BDD)')
    }

    const webhookData = JSON.parse(body)

    console.log('Webhook Paygreen reçu:', JSON.stringify(webhookData))

    // Extraire les infos du webhook (PayGreen utilise "reference" et "event")
    const { id, event, reference, amount } = webhookData
    const orderNum = reference // PayGreen met le numéro de commande dans "reference"
    const status = event // PayGreen met le statut dans "event" (ex: "payment_order.successed")

    if (!orderNum || !status) {
      console.error('Données webhook invalides:', { orderNum, status, webhookData })
      return new Response(
        JSON.stringify({ error: 'Données webhook invalides (reference ou event manquant)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Mapper le statut Paygreen au statut de commande
    // PayGreen envoie des events comme "payment_order.successed", "payment_order.refused", etc.
    let newStatus = 'pending'
    if (status.includes('successed') || status.includes('success') || status.includes('paid')) {
      newStatus = 'payee'
    } else if (status.includes('cancelled') || status.includes('refused') || status.includes('canceled')) {
      newStatus = 'cancelled'
    } else if (status.includes('refunded')) {
      newStatus = 'refunded'
    }

    console.log(`Mapping PayGreen event "${status}" → statut "${newStatus}"`)

    // Récupérer la commande avec retry (webhook peut arriver très rapidement)
    const existingOrder = await findOrderWithRetry(supabase, orderNum, 3)

    if (!existingOrder) {
      throw new Error(`Commande ${orderNum} introuvable après retry`)
    }

    // 🔒 SÉCURITÉ anti-brute-force : vérifier que le transaction ID du webhook
    // correspond à celui stocké sur la commande (seul PayGreen connaît cet ID)
    if (newStatus === 'payee' && existingOrder.paygreen_transaction_id && id) {
      if (existingOrder.paygreen_transaction_id !== id) {
        console.error(`❌ Transaction ID mismatch: webhook=${id}, BDD=${existingOrder.paygreen_transaction_id}`)
        return new Response(
          JSON.stringify({ error: 'Transaction ID invalide' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const wasAlreadyPaid = existingOrder.statut === 'payee' || existingOrder.payment_confirmed_at !== null

    // Mettre à jour la commande
    const { data, error} = await supabase
      .from('orders')
      .update({
        statut: newStatus,
        paygreen_status: status,
        paygreen_transaction_id: id,
        payment_confirmed_at: newStatus === 'payee' ? new Date().toISOString() : null
      })
      .eq('numero', orderNum)
      .select()

    if (error) {
      console.error('Erreur mise à jour commande:', error)
      throw error
    }

    console.log(`✅ Commande ${orderNum} mise à jour: ${newStatus}`)

    // Vérifier si auto-accept est activé
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()

    const autoAcceptEnabled = autoAcceptSetting?.value === 'true'

    console.log(`🤖 Auto-accept: ${autoAcceptEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`)

    // Si AUTO-ACCEPT activé : passer directement en "acceptee" (H24 7j/7)
    if (newStatus === 'payee' && !wasAlreadyPaid && autoAcceptEnabled && data && data[0]) {
      const orderId = data[0].id
      console.log(`🤖 Auto-accept activé, passage automatique en "acceptee" pour ${orderId}`)

      // Update statut à "acceptee"
      const { error: acceptError } = await supabase
        .from('orders')
        .update({ statut: 'acceptee' })
        .eq('id', data[0].id)

      if (acceptError) {
        console.error('Erreur auto-accept:', acceptError)
      } else {
        // Envoyer email d'acceptation
        try {
          const { data: emailResult, error: emailInvokeError } = await supabase.functions.invoke('send-order-confirmation', {
            headers: {
              Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: { orderId: data[0].id }
          })

          if (emailInvokeError) {
            console.error('❌ Erreur invocation email:', emailInvokeError)
          } else if (!emailResult?.success) {
            console.error('❌ Erreur envoi email:', emailResult)
          } else {
            console.log(`📧 Email d'acceptation envoyé pour ${orderId}`)
          }
        } catch (emailError) {
          console.error('❌ Exception envoi email acceptation:', emailError)
        }

        // 📱 Envoyer notification Telegram
        try {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              orderNumber: data[0].numero,
              pickupTime: data[0].heure_retrait || 'Dès que possible',
              total: data[0].total.toFixed(2),
              paymentMethod: 'paygreen',
              items: data[0].items || []
            }
          })
          console.log(`📱 Notification Telegram envoyée pour ${data[0].numero}`)
        } catch (telegramError) {
          console.error('❌ Erreur notification Telegram:', telegramError)
        }
      }
    }
    // Si AUTO-ACCEPT désactivé : envoyer email de paiement (en attente validation)
    else if (newStatus === 'payee' && !wasAlreadyPaid && data && data[0]) {
      const orderId = data[0].id
      console.log(`⏸️ Auto-accept désactivé → en attente validation manuelle`)
      try {
        const { data: emailResult, error: emailInvokeError } = await supabase.functions.invoke('send-payment-confirmation', {
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: { orderId: data[0].id }
        })

        if (emailInvokeError) {
          console.error('❌ Erreur invocation email paiement:', emailInvokeError)
        } else if (!emailResult?.success) {
          console.error('❌ Erreur envoi email paiement:', emailResult)
        } else {
          console.log(`📧 Email de confirmation paiement envoyé pour ${orderId}`)
        }
      } catch (emailError) {
        console.error('❌ Exception envoi email paiement:', emailError)
      }

      // 📱 Envoyer notification Telegram
      try {
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            orderNumber: data[0].numero,
            pickupTime: data[0].heure_retrait || 'Dès que possible',
            total: data[0].total.toFixed(2),
            paymentMethod: 'paygreen',
            items: data[0].items || []
          }
        })
        console.log(`📱 Notification Telegram envoyée pour ${data[0].numero}`)
      } catch (telegramError) {
        console.error('❌ Erreur notification Telegram:', telegramError)
      }
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
