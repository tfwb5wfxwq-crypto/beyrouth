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
      .select('id, statut, payment_confirmed_at')
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

// 🔒 SÉCURITÉ : Vérifier si le restaurant est ouvert (Lun-Ven 11h30-21h00)
function isOpenNow(): boolean {
  const now = new Date()
  // Convert to Paris timezone (UTC+1 or UTC+2 depending on DST)
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const day = parisTime.getDay() // 0=Dimanche, 1=Lundi, ..., 5=Vendredi
  const h = parisTime.getHours()
  const m = parisTime.getMinutes()
  const nowMin = h * 60 + m

  // Lun-Ven (1-5) de 11h30 (690 min) à 21h00 (1260 min)
  if (day >= 1 && day <= 5) {
    return nowMin >= 690 && nowMin < 1260
  }
  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔒 SÉCURITÉ : Vérification HMAC (signature PayGreen)
    const signature = req.headers.get('signature') // PayGreen utilise "signature" (pas "x-paygreen-signature")
    const webhookHmac = Deno.env.get('PAYGREEN_WEBHOOK_HMAC')

    if (!webhookHmac) {
      console.error('❌ PAYGREEN_WEBHOOK_HMAC non configuré')
      return new Response(
        JSON.stringify({ error: 'Webhook HMAC not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!signature) {
      console.error('❌ Signature HMAC manquante dans webhook')
      return new Response(
        JSON.stringify({ error: 'Missing HMAC signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier la signature HMAC (PayGreen utilise base64, pas hex)
    const body = await req.text()
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookHmac),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // PayGreen envoie la signature en base64
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0))
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(body)
    )

    if (!isValid) {
      console.error('❌ Signature HMAC invalide')
      return new Response(
        JSON.stringify({ error: 'Invalid HMAC signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

    const isOpen = isOpenNow()
    console.log(`🤖 Auto-accept: ${autoAcceptEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`)
    console.log(`🕐 Restaurant: ${isOpen ? 'OUVERT' : 'FERMÉ'}`)

    // Si AUTO-ACCEPT activé ET restaurant OUVERT : passer directement en "acceptee"
    if (newStatus === 'payee' && !wasAlreadyPaid && autoAcceptEnabled && isOpen && data && data[0]) {
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
          await supabase.functions.invoke('send-order-confirmation', {
            body: { orderId: data[0].id }
          })
          console.log(`📧 Email d'acceptation envoyé pour ${orderId}`)
        } catch (emailError) {
          console.error('Erreur envoi email acceptation:', emailError)
        }
      }
    }
    // Si AUTO-ACCEPT désactivé OU restaurant FERMÉ : envoyer email de paiement (en attente validation)
    else if (newStatus === 'payee' && !wasAlreadyPaid && data && data[0]) {
      const reason = !autoAcceptEnabled ? 'Auto-accept désactivé' : 'Restaurant fermé'
      console.log(`⏸️ ${reason} → en attente validation manuelle`)
      try {
        const emailResponse = await supabase.functions.invoke('send-payment-confirmation', {
          body: { orderId: data[0].id }
        })

        if (emailResponse.error) {
          console.error('Erreur envoi email paiement:', emailResponse.error)
        } else {
          console.log(`📧 Email de confirmation paiement envoyé pour ${orderId}`)
        }
      } catch (emailError) {
        console.error('Erreur appel send-payment-confirmation:', emailError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, order: orderId, status: newStatus }),
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
