// Webhook Edenred pour valider les paiements Ticket Restaurant
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Edenred envoie depuis leurs serveurs
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookData = await req.json()

    console.log('Webhook Edenred reçu:', JSON.stringify(webhookData))

    // Format webhook Edenred (à adapter selon leur doc réelle)
    // Exemple possible: { paymentId, merchantReference, status, amount }
    const { paymentId, merchantReference, status, amount } = webhookData

    if (!merchantReference || !status) {
      return new Response(
        JSON.stringify({ error: 'Données webhook invalides' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // merchantReference = notre orderNum (numero de commande)
    const orderNum = merchantReference

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Mapper le statut Edenred au statut de commande
    // Statuts Edenred possibles: SUCCEEDED, PENDING, CANCELLED, FAILED, etc.
    let newStatus = 'pending'
    if (status === 'SUCCEEDED' || status === 'SUCCESS' || status === 'PAID') {
      newStatus = 'payee'
    } else if (status === 'CANCELLED' || status === 'REFUSED' || status === 'FAILED') {
      newStatus = 'cancelled'
    } else if (status === 'REFUNDED') {
      newStatus = 'refunded'
    }

    // Récupérer la commande pour vérifier si email déjà envoyé
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, statut, payment_confirmed_at')
      .eq('numero', orderNum)
      .single()

    const wasAlreadyPaid = existingOrder?.statut === 'payee' || existingOrder?.payment_confirmed_at !== null

    // Mettre à jour la commande
    const { data, error } = await supabase
      .from('orders')
      .update({
        statut: newStatus,
        edenred_status: status,
        edenred_payment_id: paymentId,
        payment_confirmed_at: newStatus === 'payee' ? new Date().toISOString() : null
      })
      .eq('numero', orderNum)
      .select()

    if (error) {
      console.error('Erreur mise à jour commande:', error)
      throw error
    }

    console.log(`✅ Commande ${orderNum} mise à jour: ${newStatus} (Edenred)`)

    // Vérifier si auto-accept est activé
    const { data: autoAcceptSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_accept_orders')
      .maybeSingle()

    const autoAcceptEnabled = autoAcceptSetting?.value === 'true'

    // Envoyer email immédiat après paiement UNIQUEMENT si:
    // - Statut = payee
    // - Pas déjà payé
    // - Auto-accept DÉSACTIVÉ (sinon email d'acceptation va suivre immédiatement)
    if (newStatus === 'payee' && !wasAlreadyPaid && !autoAcceptEnabled && data && data[0]) {
      try {
        const emailResponse = await supabase.functions.invoke('send-payment-confirmation', {
          body: { orderId: data[0].id }
        })

        if (emailResponse.error) {
          console.error('Erreur envoi email paiement:', emailResponse.error)
        } else {
          console.log(`📧 Email de confirmation paiement envoyé pour ${orderNum}`)
        }
      } catch (emailError) {
        console.error('Erreur appel send-payment-confirmation:', emailError)
        // Ne pas bloquer le webhook si l'email échoue
      }
    } else if (autoAcceptEnabled && newStatus === 'payee') {
      console.log(`⏭️  Email paiement skippé (auto-accept activé, email d'acceptation va suivre)`)
    }

    return new Response(
      JSON.stringify({ success: true, order: orderNum, status: newStatus }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur webhook Edenred:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
