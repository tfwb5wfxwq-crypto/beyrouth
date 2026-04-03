// Helper: Validation admin via Supabase Auth JWT
// Remplace l'ancien système admin_sessions (UUID custom)
// Usage: const { user, error } = await validateAdminJWT(req, supabase)

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export async function validateAdminJWT(req: Request, supabase: SupabaseClient): Promise<{ user: any | null, errorResponse: Response | null }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Non autorisé - token requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  const token = authHeader.replace('Bearer ', '')

  // Valider le JWT Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return {
      user: null,
      errorResponse: new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  return { user, errorResponse: null }
}
