// Edge Function: Récupérer le statut d'une commande par numéro (sans exposer les données sensibles)
// Remplace le SELECT anon direct sur la table orders
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
    const url = new URL(req.url)
    const numero = url.searchParams.get('numero')

    if (!numero || numero.length < 4 || numero.length > 10) {
      return new Response(
        JSON.stringify({ error: 'Numéro de commande invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('numero, statut, heure_retrait, items, total, created_at')
      .eq('numero', numero)
      .single()

    if (error || !order) {
      return new Response(
        JSON.stringify({ error: 'Commande introuvable' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Retourner uniquement les champs nécessaires pour l'affichage (pas d'email/téléphone)
    return new Response(
      JSON.stringify({
        numero: order.numero,
        statut: order.statut,
        heure_retrait: order.heure_retrait,
        items: order.items,
        total: order.total,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur get-order-status:', error)
    return new Response(
      JSON.stringify({ error: 'Erreur serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
