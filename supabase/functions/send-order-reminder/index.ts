// Edge Function: Envoyer email de relance si client n'est pas venu
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaBrevo } from '../_shared/brevo-email.ts'
import { t, type Lang } from '../_shared/email-i18n.ts'

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

        // 🔒 Valider le JWT Supabase Auth
    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(adminToken)
    if (authError || !adminUser) {
      return new Response(
        JSON.stringify({ error: 'Token invalide ou expiré' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const lang: Lang = (order.language === 'en') ? 'en' : 'fr'
    const tr = t(lang)

    // Formater l'heure de retrait
    const rawPickup = order.heure_retrait || ''
    let pickupText = tr.asap
    let subjectPickup = tr.asap.toLowerCase()

    if (rawPickup && rawPickup !== 'asap' && rawPickup !== 'ASAP') {
      const isToday = /^Aujourd'hui\s+/i.test(rawPickup)
      const heureOnly = rawPickup.replace(/^Aujourd'hui\s+/i, '')
      pickupText = heureOnly
      subjectPickup = isToday ? (lang === 'fr' ? `aujourd'hui à ${heureOnly}` : `today at ${heureOnly}`) : rawPickup.toLowerCase()
    }

    // Template email (Gmail-compatible - tables, solid colors, no flex/gradient)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="only light">
  <meta name="supported-color-schemes" content="light">
  <style>
    :root { color-scheme: light only; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #f5f5f5 !important; }
      .header-dark { background-color: #000000 !important; }
      .card-dark { background-color: #1a1a1a !important; }
      .content-white { background-color: #ffffff !important; color: #1a1a1a !important; }
    }
  </style>
  <title>Votre commande vous attend</title>
</head>
<body bgcolor="#f5f5f5" style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f5f5f5" style="background:#f5f5f5;">
    <tr>
      <td align="center" bgcolor="#f5f5f5" style="background:#f5f5f5;padding:0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header fond noir avec logo -->
          <tr>
            <td bgcolor="#000000" style="background-color:#000000 !important;padding:8px 24px;text-align:center;">
              <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;padding:32px 24px;">

              <!-- Alerte orange -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fef3c7;padding:16px 20px;">
                    <span style="font-size:16px;font-weight:600;color:#92400e;">${tr.orderWaiting}</span>
                  </td>
                </tr>
              </table>

              <!-- Numéro + Heure -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">${tr.order}</td>
                        <td style="text-align:right;font-size:22px;font-weight:700;font-family:'Courier New',monospace;color:#1a1a1a;">${order.numero}</td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e0e0e0;">
                      <tr>
                        <td style="padding-top:12px;font-size:12px;color:#888;text-transform:uppercase;">${tr.pickup}</td>
                        <td style="padding-top:12px;text-align:right;font-size:15px;font-weight:600;color:#1a1a1a;">${pickupText}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Adresse avec GIF localisation -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e0e0e0;">
                <tr>
                  <td style="padding:16px 0 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#1a1a1a" style="background-color:#1a1a1a !important;border-radius:10px;padding:0;">
                          <table width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td width="180" style="padding:0;vertical-align:top;width:180px;line-height:0;">
                                <img src="https://beyrouth.express/img/beyrouth-location.gif" alt="Sortie métro La Défense" width="180" height="270" style="display:block;width:180px;height:270px;border-radius:10px 0 0 10px;">
                              </td>
                              <td style="padding:16px 16px 16px 14px;vertical-align:middle;">
                                <div style="font-size:10px;color:#777777;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">${tr.wherePickup}</div>
                                <div style="font-size:16px;color:#ffffff;font-weight:800;margin-bottom:6px;font-family:Georgia,serif;">A Beyrouth</div>
                                <div style="height:1px;background:#333333;margin-bottom:10px;"></div>
                                <div style="font-size:12px;color:#aaaaaa;line-height:1.7;margin-bottom:10px;">4 Esplanade du<br>Général de Gaulle<br>92400 Courbevoie</div>
                                <div style="font-size:11px;color:#666666;margin-bottom:16px;">${tr.metro}</div>
                                <a href="https://www.google.com/maps/search/A+Beyrouth+4+Esplanade+du+General+de+Gaulle+92400+Courbevoie" target="_blank" style="display:block;background:#E65100;color:#ffffff;text-decoration:none;padding:10px 0;border-radius:7px;font-weight:600;font-size:12px;text-align:center;">${tr.viewMaps}</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f5f5f5" style="background:#f5f5f5;padding:32px 24px;border-top:1px solid #e0e0e0;text-align:center;">

              <!-- Instagram -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center" style="font-size:12px;color:#aaa;letter-spacing:0.5px;text-transform:uppercase;padding-bottom:8px;">${tr.followUs}</td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="https://www.instagram.com/a_beyrouth/" target="_blank" style="display:inline-block;background:#fafafa;color:#1a1a1a;text-decoration:none;padding:10px 28px;border-radius:20px;font-weight:600;font-size:14px;border:1px solid #e0e0e0;letter-spacing:0.3px;">
                      @a_beyrouth
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Adresse -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;font-size:13px;color:#888;line-height:1.6;">
                    <strong style="color:#1a1a1a;">A Beyrouth</strong> · 4 Esp. Gal de Gaulle, 92400 Courbevoie<br>
                    <a href="https://beyrouth.express" style="color:#D4A853;text-decoration:none;">beyrouth.express</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    // Envoyer l'email via Brevo API
    const emailResult = await sendEmailViaBrevo({
      to: order.client_email,
      subject: tr.subjectReminder(order.numero, subjectPickup),
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
