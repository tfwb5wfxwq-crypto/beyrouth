// Edge Function: Toggle menu item disponibilité (sécurisé avec code admin)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Code admin (identique à celui dans la table settings)
const ADMIN_CODE = 'A5qYIeJatg'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code_admin, item_id, disponible } = await req.json()

    // Vérification du code admin
    if (!code_admin || code_admin !== ADMIN_CODE) {
      return new Response(
        JSON.stringify({ error: 'Code admin invalide' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérification des paramètres
    if (!item_id || disponible === undefined) {
      return new Response(
        JSON.stringify({ error: 'Paramètres manquants (item_id, disponible)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase avec service_role_key (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // UPDATE sécurisé
    const { data, error } = await supabase
      .from('menu_items')
      .update({ disponible })
      .eq('id', item_id)
      .select()

    if (error) {
      console.error('❌ Erreur UPDATE menu_items:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Item introuvable', item_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Menu item ${item_id} → disponible: ${disponible}`)

    return new Response(
      JSON.stringify({ success: true, data: data[0] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur toggle-menu-item:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
