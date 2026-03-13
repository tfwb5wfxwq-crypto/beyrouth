// Vérifie le statut d'un paiement Edenred via "Get Transaction By ID"
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
    const { transaction_id, order_num } = await req.json()

    if (!transaction_id || !order_num) {
      return new Response(
        JSON.stringify({ error: 'transaction_id et order_num requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Vérification paiement Edenred: ${transaction_id} (commande ${order_num})`)

    // Récupérer les credentials Edenred depuis Supabase Secrets
    const clientId = Deno.env.get('EDENRED_PAYMENT_CLIENT_ID')
    const clientSecret = Deno.env.get('EDENRED_PAYMENT_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Credentials Edenred manquants')
    }

    // 1. Obtenir un access token OAuth (UAT)
    const tokenResponse = await fetch('https://sso.sbx.edenred.io/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Erreur OAuth Edenred:', errorText)
      throw new Error('Échec authentification Edenred')
    }

    const { access_token } = await tokenResponse.json()

    // 2. Appeler "Get Transaction By ID" (UAT)
    const paymentResponse = await fetch(
      `https://directpayment.stg.eu.edenred.io/v2/transactions/${transaction_id}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        }
      }
    )

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text()
      console.error('Erreur Get Transaction Edenred:', errorText)

      // Transaction pas encore créée ou invalide
      if (paymentResponse.status === 404) {
        return new Response(
          JSON.stringify({ status: 'PENDING', message: 'Transaction non trouvée (en attente)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      throw new Error('Échec récupération transaction Edenred')
    }

    const paymentData = await paymentResponse.json()
    const edenredStatus = paymentData.status // SUCCEEDED, PENDING, CANCELLED, FAILED, etc.

    console.log(`📊 Statut Edenred pour ${transaction_id}: ${edenredStatus}`)

    // 3. Mapper le statut Edenred au statut de commande
    let orderStatus = 'pending'
    if (edenredStatus === 'SUCCEEDED' || edenredStatus === 'SUCCESS' || edenredStatus === 'PAID') {
      orderStatus = 'payee'
    } else if (edenredStatus === 'CANCELLED' || edenredStatus === 'REFUSED' || edenredStatus === 'FAILED') {
      orderStatus = 'cancelled'
    } else if (edenredStatus === 'REFUNDED') {
      orderStatus = 'refunded'
    } else {
      // PENDING ou autre statut intermédiaire
      return new Response(
        JSON.stringify({ status: edenredStatus, message: 'Paiement en cours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Mettre à jour la commande dans Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier si déjà payée (éviter double traitement)
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, statut, payment_confirmed_at')
      .eq('numero', order_num)
      .single()

    if (!existingOrder) {
      throw new Error(`Commande ${order_num} introuvable`)
    }

    const wasAlreadyPaid = existingOrder.statut === 'payee' || existingOrder.payment_confirmed_at !== null

    // Update order
    const { data, error } = await supabase
      .from('orders')
      .update({
        statut: orderStatus,
        edenred_status: edenredStatus,
        edenred_payment_id: transaction_id,
        payment_confirmed_at: orderStatus === 'payee' ? new Date().toISOString() : null
      })
      .eq('numero', order_num)
      .select()

    if (error) {
      console.error('Erreur mise à jour commande:', error)
      throw error
    }

    console.log(`✅ Commande ${order_num} mise à jour: ${orderStatus} (Edenred ${edenredStatus})`)

    // 5. Si paiement réussi et pas déjà payé, gérer auto-accept et email
    if (orderStatus === 'payee' && !wasAlreadyPaid && data && data[0]) {
      // Vérifier si auto-accept est activé
      const { data: autoAcceptSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'auto_accept_orders')
        .maybeSingle()

      const autoAcceptEnabled = autoAcceptSetting?.value === 'true'

      if (autoAcceptEnabled) {
        // Auto-accept: passer directement à "acceptee"
        await supabase
          .from('orders')
          .update({ statut: 'acceptee' })
          .eq('id', data[0].id)

        console.log(`⚡ Auto-accept: commande ${order_num} acceptée automatiquement`)

        // Envoyer email de confirmation (acceptation)
        try {
          await supabase.functions.invoke('send-order-confirmation', {
            body: { orderId: data[0].id }
          })
          console.log(`📧 Email de confirmation envoyé pour ${order_num}`)
        } catch (emailError) {
          console.error('Erreur envoi email:', emailError)
        }
      } else {
        // Pas d'auto-accept: envoyer email de paiement confirmé
        try {
          await supabase.functions.invoke('send-payment-confirmation', {
            body: { orderId: data[0].id }
          })
          console.log(`📧 Email de paiement confirmé envoyé pour ${order_num}`)
        } catch (emailError) {
          console.error('Erreur envoi email:', emailError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: edenredStatus,
        order_status: orderStatus,
        order_num,
        success: orderStatus === 'payee'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur check-edenred-payment:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
