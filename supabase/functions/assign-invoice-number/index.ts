// Edge Function: Attribuer numéro de facture à une commande
// Thread-safe et idempotent (peut être appelé plusieurs fois sans créer de doublons)

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
    const { orderId, orderNumber, siret, company, address } = await req.json()

    if (!orderId && !orderNumber) {
      return new Response(
        JSON.stringify({ error: 'orderId ou orderNumber requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Trouver la commande par ID ou numéro
    let order
    if (orderId) {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      order = data
    } else {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('numero', orderNumber)
        .single()
      order = data
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: 'Commande introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier si la commande a déjà une facture
    if (order.invoice_number) {
      console.log(`⏭️  Facture déjà générée: ${order.invoice_number}`)
      return new Response(
        JSON.stringify({
          success: true,
          invoiceNumber: order.invoice_number,
          alreadyGenerated: true,
          order: order
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Appeler la fonction SQL pour assigner le numéro (thread-safe)
    const { data: result, error: funcError } = await supabase
      .rpc('assign_invoice_to_order', {
        p_order_id: order.id,
        p_siret: siret || null,
        p_company: company || null,
        p_address: address || null
      })

    if (funcError) {
      console.error('❌ Erreur fonction SQL:', funcError)
      throw funcError
    }

    if (!result || result.length === 0) {
      throw new Error('Aucun résultat de la fonction SQL')
    }

    const invoiceData = result[0]
    console.log(`✅ Facture générée: ${invoiceData.invoice_number}`)

    return new Response(
      JSON.stringify({
        success: true,
        invoiceNumber: invoiceData.invoice_number,
        alreadyGenerated: false,
        order: invoiceData.order_data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur assign-invoice-number:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
