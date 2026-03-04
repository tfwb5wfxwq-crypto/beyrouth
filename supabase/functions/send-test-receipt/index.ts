// Edge Function publique pour envoyer un email de test
// Utilisée par le mode test (?test=1) pour tester l'envoi d'emails sans payer
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderNum } = await req.json()

    if (!orderNum) {
      return new Response(
        JSON.stringify({ error: 'orderNum requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase avec service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande avec ses items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_items(nom, prix, image_url))')
      .eq('numero', orderNum)
      .single()

    if (orderError || !order) {
      console.error('Commande non trouvée:', orderError)
      return new Response(
        JSON.stringify({ error: 'Commande non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater les items
    const items = order.order_items.map((item: any) => ({
      nom: item.menu_items.nom,
      qty: item.quantite,
      prix: item.menu_items.prix,
      image: item.menu_items.image_url
    }))

    // Appeler send-receipt avec service role key
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
      const errorText = await emailRes.text()
      console.error('Erreur send-receipt:', errorText)
      return new Response(
        JSON.stringify({ error: 'Erreur envoi email', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailData = await emailRes.json()
    console.log('✅ Email test envoyé à', order.client_email, '- Message ID:', emailData.messageId)

    return new Response(
      JSON.stringify({
        success: true,
        email: order.client_email,
        messageId: emailData.messageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erreur send-test-receipt:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
