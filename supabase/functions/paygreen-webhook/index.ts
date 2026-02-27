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
    const webhookData = await req.json()

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

    // Si paiement validé, envoyer email de confirmation (TODO)
    if (newStatus === 'payee' && data && data.length > 0) {
      const order = data[0]
      console.log(`✅ Paiement validé pour ${order.client_email}`)
      // TODO: Envoyer email via Resend ou SendGrid
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
