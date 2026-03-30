import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, deviceId } = await req.json()

    // Get admin code from Supabase secrets
    const ADMIN_CODE = Deno.env.get('ADMIN_CODE') || '123456'

    // 🔒 SÉCURITÉ : Rate limiting brute-force protection
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    const now = new Date()

    // Vérifier les tentatives existantes
    const { data: rateLimit } = await supabase
      .from('rate_limit_tracking')
      .select('attempts, blocked_until, last_attempt')
      .eq('ip_address', clientIp)
      .eq('endpoint', 'admin-auth')
      .maybeSingle()

    // Vérifier si l'IP est bloquée
    if (rateLimit?.blocked_until && new Date(rateLimit.blocked_until) > now) {
      const remainingMin = Math.ceil((new Date(rateLimit.blocked_until).getTime() - now.getTime()) / 60000)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Trop de tentatives. Réessayez dans ${remainingMin} minute${remainingMin > 1 ? 's' : ''}.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    // Vérifier si trop de tentatives (5 max)
    if (rateLimit && rateLimit.attempts >= 5) {
      const blockUntil = new Date(now.getTime() + 60 * 60 * 1000) // 1 heure
      await supabase
        .from('rate_limit_tracking')
        .upsert({
          ip_address: clientIp,
          endpoint: 'admin-auth',
          attempts: rateLimit.attempts,
          blocked_until: blockUntil.toISOString(),
          last_attempt: now.toISOString()
        })

      return new Response(
        JSON.stringify({ success: false, error: 'Trop de tentatives. Réessayez dans 1 heure.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    if (code === ADMIN_CODE) {
      // ✅ Code correct → Reset attempts
      if (rateLimit) {
        await supabase
          .from('rate_limit_tracking')
          .delete()
          .eq('ip_address', clientIp)
          .eq('endpoint', 'admin-auth')
      }

      // 🔄 RÉUTILISER SESSION EXISTANTE PAR DEVICE_ID (comme Facebook/Google)
      let token: string
      let expiresAt: Date
      const userAgent = req.headers.get('user-agent') || 'unknown'

      if (deviceId) {
        // Vérifier si une session existe pour ce device_id
        const { data: existingSession } = await supabase
          .from('admin_sessions')
          .select('token, expires_at')
          .eq('device_id', deviceId)
          .gt('expires_at', now.toISOString())
          .maybeSingle()

        if (existingSession) {
          // ✅ Session existante trouvée → Prolonger l'expiration et réutiliser le token
          token = existingSession.token
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours

          await supabase
            .from('admin_sessions')
            .update({
              expires_at: expiresAt.toISOString(),
              last_activity: now.toISOString(),
              ip_address: clientIp, // Mettre à jour l'IP au cas où elle a changé
              user_agent: userAgent  // Mettre à jour user_agent (maj navigateur)
            })
            .eq('token', token)

          console.log(`✅ Session réutilisée pour device ${deviceId.substring(0, 8)}...`)
        } else {
          // ❌ Aucune session active pour ce device → Créer une nouvelle
          token = crypto.randomUUID()
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours

          try {
            await supabase.from('admin_sessions').insert({
              token: token,
              device_id: deviceId,
              ip_address: clientIp,
              user_agent: userAgent,
              expires_at: expiresAt.toISOString()
            })
            console.log(`✅ Nouvelle session créée pour device ${deviceId.substring(0, 8)}...`)
          } catch (insertError) {
            console.error('❌ Erreur stockage session:', insertError)
          }
        }
      } else {
        // Fallback si pas de device_id (ancien client) → Utiliser IP comme avant
        const { data: existingSession } = await supabase
          .from('admin_sessions')
          .select('token, expires_at')
          .eq('ip_address', clientIp)
          .is('device_id', null)
          .gt('expires_at', now.toISOString())
          .maybeSingle()

        if (existingSession) {
          token = existingSession.token
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          await supabase
            .from('admin_sessions')
            .update({
              expires_at: expiresAt.toISOString(),
              last_activity: now.toISOString()
            })
            .eq('token', token)
          console.log(`✅ Session IP réutilisée (legacy) ${clientIp}`)
        } else {
          token = crypto.randomUUID()
          expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          await supabase.from('admin_sessions').insert({
            token: token,
            ip_address: clientIp,
            user_agent: userAgent,
            expires_at: expiresAt.toISOString()
          })
          console.log(`✅ Nouvelle session IP créée (legacy) ${clientIp}`)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          token,
          expiresIn: 2592000 // 30 jours (équilibre sécurité/UX)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        },
      )
    } else {
      // ❌ Code incorrect → Incrémenter attempts
      const newAttempts = (rateLimit?.attempts || 0) + 1
      await supabase
        .from('rate_limit_tracking')
        .upsert({
          ip_address: clientIp,
          endpoint: 'admin-auth',
          attempts: newAttempts,
          last_attempt: now.toISOString(),
          blocked_until: null
        })

      console.log(`❌ Tentative échouée ${newAttempts}/5 pour IP ${clientIp}`)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Code incorrect',
          remainingAttempts: Math.max(0, 5 - newAttempts)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        },
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      },
    )
  }
})
