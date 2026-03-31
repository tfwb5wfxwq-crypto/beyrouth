// Edge Function temporaire pour fixer RLS admin_sessions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Exécuter le SQL de fix
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "service_role_only" ON admin_sessions;

        CREATE POLICY "service_role_full_access" ON admin_sessions
          FOR ALL
          USING (auth.role() = 'service_role')
          WITH CHECK (auth.role() = 'service_role');
      `
    })

    if (error) {
      console.error('Erreur SQL:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'RLS policy fixed!' }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
