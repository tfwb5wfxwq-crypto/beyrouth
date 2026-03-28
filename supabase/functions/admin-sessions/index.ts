// Edge Function: Lister les sessions admin actives (audit)
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
    // 🔒 SÉCURITÉ: Vérifier que l'appelant est authentifié admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token admin requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    // Connexion avec service_role_key (bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier que le token de l'appelant est valide
    const { data: callerSession, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !callerSession) {
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer TOUTES les sessions actives (non expirées)
    const { data: sessions, error: fetchError } = await supabase
      .from('admin_sessions')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (fetchError) {
      throw fetchError
    }

    // Nettoyer les sessions expirées (maintenance automatique)
    await supabase.rpc('clean_expired_admin_sessions')

    // Formater pour affichage
    const formattedSessions = sessions.map(session => {
      const now = new Date()
      const createdAt = new Date(session.created_at)
      const expiresAt = new Date(session.expires_at)
      const lastActivity = new Date(session.last_activity)

      // Durée depuis création
      const ageMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000)
      const ageHours = Math.floor(ageMinutes / 60)
      const ageDays = Math.floor(ageHours / 24)

      let ageStr = ''
      if (ageDays > 0) ageStr = `${ageDays}j ${ageHours % 24}h`
      else if (ageHours > 0) ageStr = `${ageHours}h ${ageMinutes % 60}min`
      else ageStr = `${ageMinutes}min`

      // Temps restant avant expiration
      const remainingMs = expiresAt.getTime() - now.getTime()
      const remainingHours = Math.floor(remainingMs / 3600000)
      const remainingDays = Math.floor(remainingHours / 24)

      let expiresStr = ''
      if (remainingDays > 0) expiresStr = `${remainingDays}j ${remainingHours % 24}h`
      else if (remainingHours > 0) expiresStr = `${remainingHours}h`
      else expiresStr = `${Math.floor(remainingMs / 60000)}min`

      // Dernière activité
      const lastActivityMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000)
      let lastActivityStr = ''
      if (lastActivityMinutes === 0) lastActivityStr = 'À l\'instant'
      else if (lastActivityMinutes < 60) lastActivityStr = `Il y a ${lastActivityMinutes}min`
      else lastActivityStr = `Il y a ${Math.floor(lastActivityMinutes / 60)}h`

      return {
        token: session.token.substring(0, 8) + '...', // Masquer token complet
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        created_at: createdAt.toLocaleString('fr-FR'),
        age: ageStr,
        expires_in: expiresStr,
        last_activity: lastActivityStr,
        is_current: session.token === adminToken
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        total_sessions: formattedSessions.length,
        sessions: formattedSessions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur admin-sessions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
