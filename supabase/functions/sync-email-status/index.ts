// Edge Function: Synchroniser statut email depuis Brevo
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
    const { orderId, messageId } = await req.json()

    if (!orderId || !messageId) {
      return new Response(
        JSON.stringify({ error: 'orderId et messageId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande pour avoir l'email
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('client_email')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error('Commande introuvable')
    }

    // Récupérer les événements Brevo
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    if (!brevoApiKey) {
      throw new Error('BREVO_API_KEY not configured')
    }

    // Nettoyer le messageId (enlever les < >)
    const cleanMessageId = messageId.replace(/[<>]/g, '')

    const response = await fetch(
      `https://api.brevo.com/v3/smtp/emails?messageId=${cleanMessageId}&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
          'api-key': brevoApiKey
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Brevo API error: ${response.status}`)
    }

    const data = await response.json()

    if (!data.transactionalEmails || data.transactionalEmails.length === 0) {
      console.log(`⏳ Email ${messageId} pas encore indexé par Brevo`)
      return new Response(
        JSON.stringify({ success: true, status: 'pending', message: 'Not indexed yet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const email = data.transactionalEmails[0]
    const uuid = email.uuid

    // Récupérer les événements détaillés
    const detailsResponse = await fetch(
      `https://api.brevo.com/v3/smtp/emails/${uuid}`,
      {
        headers: {
          'Accept': 'application/json',
          'api-key': brevoApiKey
        }
      }
    )

    if (!detailsResponse.ok) {
      throw new Error(`Brevo details API error: ${detailsResponse.status}`)
    }

    const details = await detailsResponse.json()
    const events = details.events || []

    // Analyser les événements
    let status = 'sent'
    let deliveredAt = null
    let openedAt = null
    let error = null

    for (const event of events) {
      if (event.name === 'error') {
        status = 'error'
        error = event.reason || 'Unknown error'
      } else if (event.name === 'delivered') {
        status = 'delivered'
        deliveredAt = event.time
      } else if (event.name === 'opened' || event.name === 'proxy_open') {
        status = 'opened'
        openedAt = event.time
      }
    }

    // Mettre à jour la commande
    const updateData: any = { email_status: status }
    if (deliveredAt) updateData.email_delivered_at = deliveredAt
    if (openedAt) updateData.email_opened_at = openedAt
    if (error) updateData.email_error = error

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      throw new Error(`Update error: ${updateError.message}`)
    }

    console.log(`✅ Statut email synced pour commande ${orderId}: ${status}`)

    return new Response(
      JSON.stringify({ success: true, status, deliveredAt, openedAt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sync-email-status:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
