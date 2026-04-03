// Edge Function: Infos sur la session admin courante (Supabase Auth)
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Valider le JWT Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer l'IP depuis les headers
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'Inconnue'
    const userAgent = req.headers.get('user-agent') || 'Inconnu'

    // Retourner la session courante
    const now = new Date()
    const createdAt = new Date(user.created_at)
    const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : now

    const lastSignInMinutes = Math.floor((now.getTime() - lastSignIn.getTime()) / 60000)
    let lastActivityStr = ''
    if (lastSignInMinutes === 0) lastActivityStr = 'À l\'instant'
    else if (lastSignInMinutes < 60) lastActivityStr = `Il y a ${lastSignInMinutes}min`
    else if (lastSignInMinutes < 1440) lastActivityStr = `Il y a ${Math.floor(lastSignInMinutes / 60)}h`
    else lastActivityStr = `Il y a ${Math.floor(lastSignInMinutes / 1440)}j`

    const sessions = [{
      token: token.substring(0, 8) + '...',
      ip_address: ipAddress.split(',')[0].trim(),
      user_agent: userAgent,
      email: user.email,
      created_at: createdAt.toLocaleString('fr-FR'),
      age: lastActivityStr,
      expires_in: '~1h (auto-renouvelé)',
      last_activity: lastActivityStr,
      is_current: true
    }]

    return new Response(
      JSON.stringify({ success: true, total_sessions: 1, sessions }),
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
