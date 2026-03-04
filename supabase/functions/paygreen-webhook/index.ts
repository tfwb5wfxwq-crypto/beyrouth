// Webhook Paygreen pour valider les paiements
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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
      .select('statut, payment_confirmed_at')
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

    console.log(`Commande ${orderId} mise à jour: ${newStatus}`)

    // Si paiement validé ET pas déjà payé avant, envoyer email de confirmation
    if (newStatus === 'payee' && !wasAlreadyPaid && data && data.length > 0) {
      const order = data[0]
      console.log(`✅ Paiement validé pour ${order.client_email} (premier paiement, envoi email)`)

      try {
        // Récupérer les items de la commande
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*, menu_items(nom, prix, image_url)')
          .eq('order_id', order.id)

        // Formater les items pour l'email
        const items = orderItems?.map(item => ({
          nom: item.menu_items.nom,
          qty: item.quantite,
          prix: item.menu_items.prix,
          image: item.menu_items.image_url
        })) || []

        // Appeler l'Edge Function send-receipt
        const emailRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-receipt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            email: order.client_email,
            name: order.client_nom,
            orderNum: order.numero,
            items: items,
            total: order.total,
            pickup: order.heure_retrait === 'asap' ? 'Dès que possible' : order.heure_retrait
          })
        })

        if (!emailRes.ok) {
          console.error('Erreur envoi email:', await emailRes.text())
        } else {
          console.log('✅ Email de confirmation envoyé à', order.client_email)
        }
      } catch (emailError) {
        console.error('Erreur lors de l\'envoi de l\'email:', emailError)
        // Ne pas bloquer le webhook si l'email échoue
      }
    } else if (newStatus === 'payee' && wasAlreadyPaid) {
      console.log(`ℹ️ Commande ${orderId} déjà payée, email non envoyé (évite doublon)`)
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
