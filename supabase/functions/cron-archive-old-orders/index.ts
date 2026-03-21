// Supabase Edge Function: Cron job pour archiver les commandes anciennes
// À appeler quotidiennement (ex: 3h du matin) via Supabase Cron
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
    console.log('🗄️  Démarrage archivage automatique des commandes anciennes...')

    // Créer client Supabase avec service role (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Appeler la fonction PostgreSQL archive_old_orders()
    const { data, error } = await supabase.rpc('archive_old_orders')

    if (error) {
      console.error('❌ Erreur archivage:', error)
      throw error
    }

    const archivedCount = data || 0
    console.log(`✅ Archivage terminé : ${archivedCount} commandes archivées`)

    return new Response(
      JSON.stringify({
        success: true,
        archived_count: archivedCount,
        message: `${archivedCount} commande(s) archivée(s) avec succès`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Erreur cron archivage:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
