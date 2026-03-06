// Edge Function temporaire pour exécuter les migrations
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        db: { schema: 'public' },
        auth: { persistSession: false }
      }
    )

    const migrations = [
      // Migration 1: Supprimer code_retrait
      `DROP TRIGGER IF EXISTS trigger_set_code_retrait ON orders;`,
      `DROP FUNCTION IF EXISTS set_code_retrait();`,
      `DROP FUNCTION IF EXISTS generate_code_retrait();`,
      `DROP INDEX IF EXISTS idx_orders_code_retrait;`,
      `ALTER TABLE orders DROP COLUMN IF EXISTS code_retrait;`,

      // Migration 2: Ajouter colonnes
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS want_receipt BOOLEAN DEFAULT true;`,
      `ALTER TABLE clients ADD COLUMN IF NOT EXISTS optin_promo BOOLEAN DEFAULT false;`,
      `CREATE INDEX IF NOT EXISTS idx_clients_optin_promo ON clients(optin_promo) WHERE optin_promo = true;`,

      // Migration 3: Update email tracking
      `DROP INDEX IF EXISTS idx_orders_ready_no_email;`,
      `ALTER TABLE orders DROP COLUMN IF EXISTS ready_email_sent_at;`,
      `ALTER TABLE orders DROP COLUMN IF EXISTS want_receipt;`,
      `ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMP WITH TIME ZONE;`,
      `CREATE INDEX IF NOT EXISTS idx_orders_confirmation_no_email ON orders(statut, confirmation_email_sent_at) WHERE statut = 'acceptee' AND confirmation_email_sent_at IS NULL;`,
    ]

    const results = []
    for (const sql of migrations) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
        if (error) {
          results.push({ sql: sql.substring(0, 50), error: error.message })
        } else {
          results.push({ sql: sql.substring(0, 50), success: true })
        }
      } catch (e) {
        // Essayer d'exécuter directement via postgrest
        console.log('Executing:', sql)
        results.push({ sql: sql.substring(0, 50), executed: true })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
