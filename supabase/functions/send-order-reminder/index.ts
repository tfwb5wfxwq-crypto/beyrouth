// Edge Function: Envoyer email de relance si client n'est pas venu
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaBrevo } from '../_shared/brevo-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔒 SÉCURITÉ: Validation token admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token admin requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminToken = authHeader.replace('Bearer ', '')

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier que le token existe en BDD et n'est pas expiré
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('*')
      .eq('token', adminToken)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      console.error('❌ Token invalide ou expiré')
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ✅ Token valide → Update last_activity
    await supabase
      .from('admin_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('token', adminToken)

    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Récupérer la commande complète
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Erreur récupération commande:', orderError)
      throw new Error('Commande introuvable')
    }

    // Vérifier que la commande est acceptée
    if (order.statut !== 'acceptee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas acceptée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 🔒 Protection double-envoi
    if (order.reminder_email_sent_at) {
      console.log(`⏭️  Email de relance déjà envoyé pour ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater l'heure de retrait
    const pickupText = order.heure_retrait || 'Dès que possible'

    // Template email (nouveau design bleu)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre commande vous attend</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">

    <!-- Header (fond noir compact avec logo 240px) -->
    <div style="background:#000;padding:8px 24px;text-align:center;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;">
    </div>

    <!-- Contenu principal -->
    <div style="padding:32px 24px;">

      <!-- Alerte orange (votre commande vous attend) -->
      <div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:600;color:#92400e;">⏰ Votre commande vous attend</div>
      </div>

      <!-- Numéro de commande + Heure (encart gris comme les autres emails) -->
      <div style="background:#fafafa;padding:16px 20px;margin-bottom:20px;border-radius:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Commande</div>
          <div style="font-size:22px;font-weight:700;font-family:'Courier New',monospace;color:#1a1a1a;">${order.numero}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid #e0e0e0;">
          <div style="font-size:12px;color:#888;text-transform:uppercase;">Retrait</div>
          <div style="font-size:15px;font-weight:600;color:#1a1a1a;">${pickupText}</div>
        </div>
      </div>

      <!-- Adresse + Bouton Google Maps -->
      <div style="padding:16px 0;border-top:1px solid #e0e0e0;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">📍 Retrait</div>
        <div style="font-size:14px;color:#1a1a1a;line-height:1.5;margin-bottom:12px;">
          <strong>A Beyrouth</strong> · 4 Esp. Gal de Gaulle<br>
          92400 Courbevoie (La Défense)<br>
          <span style="font-size:12px;color:#888;">Sortie 4 du métro La Défense</span>
        </div>
        <a href="https://www.google.com/maps/search/A+Beyrouth+4+Esplanade+du+General+de+Gaulle+92400+Courbevoie" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#E65100;color:#fff;text-decoration:none;padding:9px 20px;border-radius:7px;font-weight:600;font-size:13px;box-shadow:0 2px 4px rgba(230,81,0,0.25);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Ouvrir dans Google Maps
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#fafafa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;">
      <a href="https://beyrouth.express" style="font-size:13px;color:#D4A853;text-decoration:none;">beyrouth.express</a>
    </div>

  </div>
</body>
</html>
    `

    // Envoyer l'email via Brevo API
    const emailResult = await sendEmailViaBrevo({
      to: order.client_email,
      subject: `⏰ ${order.numero} - Votre commande vous attend`,
      html: emailHtml,
      replyTo: 'contact@beyrouth.express',
      orderId: orderId
    })

    if (!emailResult.success) {
      console.error('Erreur envoi email:', emailResult.error)
      throw new Error('Erreur envoi email')
    }

    console.log(`✅ Email de relance envoyé pour ${order.numero}`)

    // Timestamp en BDD pour éviter doubles envois
    await supabase.from('orders').update({
      reminder_email_sent_at: new Date().toISOString()
    }).eq('id', orderId)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-order-reminder:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
