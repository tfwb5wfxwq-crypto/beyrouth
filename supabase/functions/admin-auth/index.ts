import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { code } = await req.json()

    // Get admin code from Supabase secrets
    const ADMIN_CODE = Deno.env.get('ADMIN_CODE') || '123456'

    if (code === ADMIN_CODE) {
      // Generate a simple token (you could use JWT here for more security)
      const token = crypto.randomUUID()

      return new Response(
        JSON.stringify({
          success: true,
          token,
          expiresIn: 604800 // 7 jours (équilibre sécurité/UX)
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        },
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Code incorrect' }),
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
