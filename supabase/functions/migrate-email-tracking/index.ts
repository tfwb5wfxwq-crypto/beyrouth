// Edge Function ONE-TIME: Ajouter colonnes email tracking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Exécuter la migration
    const { error } = await supabase.rpc('exec_migration', {
      migration_sql: `
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_delivered_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS email_error TEXT;
        CREATE INDEX IF NOT EXISTS idx_orders_email_status ON orders(email_status);
      `
    })

    if (error) {
      console.error('Migration error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Migration email tracking réussie')
    return new Response(
      JSON.stringify({ success: true, message: 'Migration completed' }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
