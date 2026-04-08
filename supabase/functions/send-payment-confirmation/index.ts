// Edge Function: Envoyer email immédiat après paiement confirmé
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
    // 🔒 Appel interne uniquement (service_role)
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // 🔒 Vérifier contre la vraie clé service_role (comparaison directe, pas décodage JWT sans signature)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (token !== serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { orderId } = await req.json()

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'orderId requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    // Vérifier que la commande est payée
    if (order.statut !== 'payee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas encore payée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.payment_email_sent_at) {
      console.log(`⏭️  Email de paiement déjà envoyé pour ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater l'heure de retrait (stripping "Aujourd'hui" comme les autres emails)
    const rawPickup = order.heure_retrait || ''
    const pickupText = rawPickup.replace(/^Aujourd'hui\s+/i, '') || 'Dès que possible'

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
    :root { color-scheme: light; }
    .email-header-bg { background-color: #000000 !important; }
  </style>
  <title>Paiement confirmé</title>
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
            <td bgcolor="#ffffff" style="background:#ffffff;padding:24px 20px;">

              <!-- Statut -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fef3c7;padding:16px 20px;">
                    <div style="font-size:16px;font-weight:600;color:#92400e;margin-bottom:4px;">✅ Paiement confirmé</div>
                    <div style="font-size:13px;color:#78350f;">En attente de validation</div>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 20px 0;">
                Vous recevrez un email de confirmation dès que le restaurant aura accepté votre commande.
              </p>

              <!-- Numéro -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">Commande</div>
                    <div style="font-size:22px;font-weight:700;font-family:'Courier New',monospace;color:#1a1a1a;">${order.numero}</div>
                  </td>
                </tr>
              </table>

              <!-- Adresse -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e0e0e0;">
                <tr>
                  <td style="padding:16px 0;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">📍 Retrait</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.5;margin-bottom:12px;">
                      <strong>A Beyrouth</strong> · 4 Esp. Gal de Gaulle<br>
                      92400 Courbevoie (La Défense)<br>
                      <span style="font-size:12px;color:#888;">Sortie 4 du métro La Défense</span>
                    </div>
                    <a href="https://www.google.com/maps/search/A+Beyrouth+4+Esplanade+du+General+de+Gaulle+92400+Courbevoie" target="_blank" style="display:inline-block;background:#E65100;color:#fff;text-decoration:none;padding:9px 20px;border-radius:7px;font-weight:600;font-size:13px;">
                      📍 Ouvrir dans Google Maps
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer avec CTA Google -->
          <tr>
            <td bgcolor="#f5f5f5" style="background:#f5f5f5;padding:32px 24px;border-top:1px solid #e0e0e0;">

              <!-- CTA Google -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#E3F2FD;border-radius:10px;padding:20px;text-align:center;">
                    <div style="font-size:20px;margin-bottom:6px;">⭐⭐⭐⭐⭐</div>
                    <div style="font-size:14px;font-weight:700;color:#1565C0;margin-bottom:4px;">Votre avis compte !</div>
                    <div style="font-size:12px;color:#1976D2;margin-bottom:14px;line-height:1.4;">Mettez-nous 5 étoiles sur Google 🙏</div>
                    <a href="https://maps.app.goo.gl/mKChLAAquBDL2C5c6" target="_blank" style="display:inline-block;background:#1976D2;color:#fff;text-decoration:none;padding:10px 22px;border-radius:7px;font-weight:600;font-size:13px;">
                      🌟 Laisser un avis
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instagram -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center" style="font-size:12px;color:#aaa;letter-spacing:0.5px;text-transform:uppercase;padding-bottom:8px;">Retrouvez-nous sur</td>
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
      subject: `✅ Paiement confirmé - Commande ${order.numero} - A Beyrouth`,
      html: emailHtml,
      replyTo: 'contact@beyrouth.express',
      orderId: orderId
    })

    if (!emailResult.success) {
      console.error('Erreur envoi email:', emailResult.error)
      throw new Error('Erreur envoi email')
    }

    // Marquer l'email comme envoyé
    await supabase
      .from('orders')
      .update({ payment_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)

    console.log(`✅ Email de paiement confirmé envoyé pour ${order.numero}`)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-payment-confirmation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
