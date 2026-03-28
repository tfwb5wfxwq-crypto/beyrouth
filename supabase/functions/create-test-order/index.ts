// Edge Function: Créer une commande de test (DEV only)
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
    // 🔒 Vérifier token admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Valider token admin
    const { data: session } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Token invalide' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Supprimer anciennes commandes test
    await supabase
      .from('orders')
      .delete()
      .eq('client_email', 'ludovikh@gmail.com')
      .eq('statut', 'acceptee')
      .like('note', '%test%')

    // Créer nouvelle commande
    const now = new Date()
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '')
    const numero = `TEST ${timeStr}`

    const { data, error } = await supabase
      .from('orders')
      .insert({
        numero: numero,
        client_prenom: 'Ludovic',
        client_nom: 'Test',
        client_email: 'ludovikh@gmail.com',
        client_telephone: '+33612345678',
        statut: 'acceptee',
        items: [{
          id: 1,
          nom: 'Falafel Sandwich',
          prix: 6.90,
          quantite: 2,
          supplements: [{ nom: 'Sauce Tahini', prix: 0.50 }]
        }],
        total: 1430, // (6.90 * 2) + (0.50 * 2) = 14.30€
        heure_retrait: 'asap',
        note: 'Commande de test pour emails + facture PDF',
        paygreen_transaction_id: `test_${Date.now()}`,
        payment_confirmed_at: now.toISOString()
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: data.id,
          numero: data.numero,
          statut: data.statut,
          total: `${(data.total / 100).toFixed(2)}€`
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur create-test-order:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
