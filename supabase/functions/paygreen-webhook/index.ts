// Webhook Paygreen pour valider les paiements
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Vérifier la signature HMAC
    const signature = req.headers.get('x-paygreen-signature')
    const webhookHmac = Deno.env.get('PAYGREEN_WEBHOOK_HMAC')

    if (webhookHmac && signature) {
      const body = await req.text()
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookHmac),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      const signatureBuffer = Uint8Array.from(signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBuffer,
        encoder.encode(body)
      )

      if (!isValid) {
        console.error('Signature HMAC invalide')
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      var webhookData = JSON.parse(body)
    } else {
      var webhookData = await req.json()
    }

    console.log('Webhook Paygreen reçu:', JSON.stringify(webhookData))

    // Extraire les infos du webhook
    const { id, status, orderId, amount } = webhookData

    if (!orderId || !status) {
      return new Response(
        JSON.stringify({ error: 'Données webhook invalides' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Mapper le statut Paygreen au statut de commande
    let newStatus = 'pending'
    if (status === 'SUCCESSED' || status === 'SUCCESS' || status === 'PAID') {
      newStatus = 'payee'
    } else if (status === 'CANCELLED' || status === 'REFUSED') {
      newStatus = 'cancelled'
    } else if (status === 'REFUNDED') {
      newStatus = 'refunded'
    }

    // Récupérer la commande pour vérifier si email déjà envoyé
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, statut, payment_confirmed_at')
      .eq('numero', orderId)
      .single()

    const wasAlreadyPaid = existingOrder?.statut === 'payee' || existingOrder?.payment_confirmed_at !== null

    // Mettre à jour la commande
    const { data, error } = await supabase
      .from('orders')
      .update({
        statut: newStatus,
        paygreen_status: status,
        paygreen_transaction_id: id,
        payment_confirmed_at: newStatus === 'payee' ? new Date().toISOString() : null
      })
      .eq('numero', orderId)
      .select()

    if (error) {
      console.error('Erreur mise à jour commande:', error)
      throw error
    }

    console.log(`✅ Commande ${orderId} mise à jour: ${newStatus}`)

    // Vérifier si auto-accept est activé
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()

    const autoAcceptEnabled = autoAcceptSetting?.value === 'true'

    // Vérifier si le restaurant est ouvert (Lun-Ven 11h30-21h00)
    const now = new Date()
    const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
    const day = parisTime.getDay() // 0 = Dimanche, 1 = Lundi, ..., 5 = Vendredi
    const hour = parisTime.getHours()
    const minute = parisTime.getMinutes()
    const currentMinutes = hour * 60 + minute

    const isWeekday = day >= 1 && day <= 5 // Lundi à Vendredi
    const isOpenHours = currentMinutes >= 11 * 60 + 30 && currentMinutes <= 21 * 60 // 11h30 - 21h00
    const isRestaurantOpen = isWeekday && isOpenHours

    console.log(`🕐 Restaurant ${isRestaurantOpen ? 'OUVERT' : 'FERMÉ'} (${day}, ${hour}h${minute})`)

    // Si AUTO-ACCEPT activé ET restaurant OUVERT ET statut = payee : passer directement en "acceptee"
    if (newStatus === 'payee' && !wasAlreadyPaid && autoAcceptEnabled && isRestaurantOpen && data && data[0]) {
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
    // Si AUTO-ACCEPT désactivé OU restaurant fermé : envoyer email de paiement (en attente validation)
    else if (newStatus === 'payee' && !wasAlreadyPaid && (!autoAcceptEnabled || !isRestaurantOpen) && data && data[0]) {
      if (autoAcceptEnabled && !isRestaurantOpen) {
        console.log(`⏰ Auto-accept activé mais restaurant fermé → en attente validation manuelle`)
      }
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
