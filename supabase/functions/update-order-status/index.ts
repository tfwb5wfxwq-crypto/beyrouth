// Edge Function: Update order status (secured with service_role_key)
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
    const { orderId, newStatus } = await req.json()

    if (!orderId || !newStatus) {
      return new Response(
        JSON.stringify({ error: 'orderId et newStatus requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion avec service_role_key (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update status
    const { data, error } = await supabase
      .from('orders')
      .update({ statut: newStatus })
      .eq('id', orderId)
      .select()
      .single()

    if (error) {
      console.error('Erreur update status:', error)
      throw error
    }

    return new Response(
      JSON.stringify({ success: true, order: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur update-order-status:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
