// Edge Function: Toggle ingredient disponibilité (sécurisé avec code admin)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_CODE = 'A5qYIeJatg'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code_admin, ingredient_id, disponible } = await req.json()

    if (!code_admin || code_admin !== ADMIN_CODE) {
      return new Response(
        JSON.stringify({ error: 'Code admin invalide' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!ingredient_id || disponible === undefined) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (ingredient_id, disponible)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabase
      .from('ingredients')
      .update({ disponible })
      .eq('id', ingredient_id)
      .select()

    if (error) {
      console.error('❌ Erreur UPDATE ingredients:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Ingrédient introuvable', ingredient_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Ingredient ${ingredient_id} → disponible: ${disponible}`)

    return new Response(
      JSON.stringify({ success: true, data: data[0] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur toggle-ingredient:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
