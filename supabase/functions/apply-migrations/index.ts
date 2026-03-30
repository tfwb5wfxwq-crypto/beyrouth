// Edge Function pour appliquer les migrations SQL
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // SQL complet avec toutes les migrations
    const sql = `
      -- 1. Ajouter colonnes de tracking des paiements
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS paygreen_payment_id TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS edenred_payment_id TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS edenred_status TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

      -- 2. Ajouter index pour recherche rapide
      CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
      CREATE INDEX IF NOT EXISTS idx_orders_paygreen_payment_id ON orders(paygreen_payment_id);
      CREATE INDEX IF NOT EXISTS idx_orders_edenred_payment_id ON orders(edenred_payment_id);

      -- 3. Fixer RLS admin_sessions
      DROP POLICY IF EXISTS "service_role_only" ON admin_sessions;
      CREATE POLICY "service_role_full_access" ON admin_sessions
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');

      -- 4. Commenter les colonnes
      COMMENT ON COLUMN orders.payment_method IS 'Moyen de paiement: "paygreen" ou "edenred"';
      COMMENT ON COLUMN orders.edenred_payment_id IS 'ID de capture Edenred pour refunds';
      COMMENT ON COLUMN orders.edenred_status IS 'Statut Edenred: "captured" ou "refunded"';
      COMMENT ON COLUMN orders.refunded_at IS 'Date du remboursement';
    `

    // Exécuter via requête brute
    const { data, error } = await supabase.rpc('query', {
      query_text: sql
    }).single()

    if (error) {
      // Si rpc('query') n'existe pas, essayer avec exec
      console.log('Tentative avec connexion directe...')

      // Fallback: exécuter ligne par ligne
      const statements = sql.split(';').filter(s => s.trim())
      const results = []

      for (const statement of statements) {
        if (!statement.trim()) continue

        try {
          const { error: stmtError } = await supabase.rpc('exec', {
            statement: statement.trim() + ';'
          })

          if (stmtError) {
            results.push({ statement: statement.substring(0, 50), error: stmtError.message })
          } else {
            results.push({ statement: statement.substring(0, 50), success: true })
          }
        } catch (e) {
          results.push({ statement: statement.substring(0, 50), error: e.message })
        }
      }

      return new Response(
        JSON.stringify({
          message: 'Migrations exécutées avec fallback',
          results
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Toutes les migrations appliquées !',
        data
      }),
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
