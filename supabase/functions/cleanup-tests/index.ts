// Edge Function: Supprimer commandes tests (sécurisé avec code admin)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_CODE = Deno.env.get('ADMIN_CODE') || 'A5qYIeJatg'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code_admin } = await req.json()

    // Vérification du code admin
    if (!code_admin || code_admin !== ADMIN_CODE) {
      return new Response(
        JSON.stringify({ error: 'Code admin invalide' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase avec service_role_key (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Supprimer commandes tests (<1€, avant 14 mars, email test)
    const { data, error, count } = await supabase
      .from('orders')
      .delete({ count: 'exact' })
      .or('total.lt.100,created_at.lt.2026-03-14,client_email.eq.ldvk@me.com')

    if (error) {
      console.error('❌ Erreur DELETE orders:', error)
      throw error
    }

    console.log(`✅ ${count} commandes tests supprimées`)

    return new Response(
      JSON.stringify({ success: true, deleted: count }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur cleanup-tests:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
