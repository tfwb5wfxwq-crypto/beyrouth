// Edge Function: Envoyer email de confirmation quand commande est acceptée
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
    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 🔒 SÉCURITÉ: Accepter soit token admin (depuis admin UI), soit service_role (depuis webhook)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé - token requis' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Vérifier si c'est un appel service_role (depuis webhook)
    const isServiceRole = token === serviceRoleKey

    if (!isServiceRole) {
      // Sinon, vérifier que c'est un token admin valide
      const { data: session, error: sessionError } = await supabase
        .from('admin_sessions')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (sessionError || !session) {
        console.error('❌ Token invalide ou expiré')
        return new Response(
          JSON.stringify({ error: 'Token invalide ou expiré' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ✅ Token admin valide → Update last_activity
      await supabase
        .from('admin_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('token', token)
    } else {
      console.log('✅ Appel depuis service_role (webhook)')
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

    // Vérifier que la commande est bien acceptée
    if (order.statut !== 'acceptee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas encore acceptée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.confirmation_email_sent_at) {
      console.log(`⏭️  Email de confirmation déjà envoyé pour commande ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construire le récapitulatif des items (avec fallback qty/quantite, name/nom, price/prix)
    const itemsHtml = order.items.map((item: any) => {
      const qty = item.qty || item.quantite || 1
      const name = item.name || item.nom || 'Article'
      const price = item.price || item.prix || 0

      let html = `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:10px 0;font-size:14px;color:#1a1a1a;">${qty}× ${name}</td>
        <td style="padding:10px 0;text-align:right;font-size:14px;color:#1a1a1a;font-weight:500;">${(price * qty).toFixed(2)}€</td>
      </tr>
      `

      // Ajouter les suppléments si présents
      if (item.supplements && item.supplements.length > 0) {
        item.supplements.forEach((supp: any) => {
          const suppName = supp.name || supp.nom || 'Supplément'
          const suppPrice = supp.price || supp.prix || 0
          html += `
      <tr style="border-bottom:1px solid #f0f0f0;">
        <td style="padding:8px 0 8px 20px;font-size:13px;color:#666;">+ ${suppName}</td>
        <td style="padding:8px 0;text-align:right;font-size:13px;color:#666;">${suppPrice.toFixed(2)}€</td>
      </tr>
          `
        })
      }

      return html
    }).join('')

    // Formater l'heure de retrait
    const rawPickup = order.heure_retrait || ''
    let pickupText = 'Dès que possible'
    let subjectPickup = 'dès que possible'

    if (rawPickup && rawPickup !== 'asap' && rawPickup !== 'ASAP') {
      const isToday = /^Aujourd'hui\s+/i.test(rawPickup)
      const heureOnly = rawPickup.replace(/^Aujourd'hui\s+/i, '')
      pickupText = heureOnly  // corps email : "16h30" ou "Lundi 12h30"
      subjectPickup = isToday ? `aujourd'hui à ${heureOnly}` : rawPickup.toLowerCase()
    }

    // Calculer TVA (10% restauration)
    const totalTTC = order.total
    const totalHT = totalTTC / 1.10
    const tva = totalTTC - totalHT

    // Template email (Gmail-compatible - tables, solid colors, no flex/gradient)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    .email-header-bg { background-color: #000000 !important; }
  </style>
  <title>Commande confirmée</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:10px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- Header fond noir avec logo -->
          <tr>
            <td class="email-header-bg" style="background:#000000;padding:8px 24px;text-align:center;">
              <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding:24px 20px;">

              <!-- Statut -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#f0fdf4;padding:16px 20px;">
                    <span style="font-size:16px;font-weight:600;color:#166534;">✅ Commande confirmée</span>
                  </td>
                </tr>
              </table>

              <!-- Numéro + Heure -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;margin-bottom:20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                      <tr>
                        <td style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Commande</td>
                        <td style="text-align:right;font-size:22px;font-weight:700;font-family:'Courier New',monospace;color:#1a1a1a;">${order.numero}</td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e0e0e0;padding-top:12px;">
                      <tr>
                        <td style="padding-top:12px;font-size:12px;color:#888;text-transform:uppercase;">Retrait</td>
                        <td style="padding-top:12px;text-align:right;font-size:15px;font-weight:600;color:#1a1a1a;">${pickupText}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                ${itemsHtml}
                <tr>
                  <td style="padding:14px 0 0 0;border-top:1px solid #e0e0e0;font-size:16px;font-weight:600;color:#1a1a1a;">Total TTC</td>
                  <td style="padding:14px 0 0 0;border-top:1px solid #e0e0e0;text-align:right;font-size:18px;font-weight:700;color:#1a1a1a;">${totalTTC.toFixed(2)}€</td>
                </tr>
              </table>

              ${order.note && order.note.trim() ? `
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fef2f2;padding:14px 18px;">
                    <div style="font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase;margin-bottom:6px;">Note</div>
                    <div style="font-size:14px;color:#7f1d1d;line-height:1.5;">${order.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                  </td>
                </tr>
              </table>
              ` : ''}

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

          <!-- Footer uniforme avec CTA avis Google -->
          <tr>
            <td style="background:#fafafa;padding:32px 24px;border-top:1px solid #e0e0e0;">

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

              <!-- Contact -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;font-size:12px;color:#888;line-height:1.6;">
                    <strong style="color:#1a1a1a;">A Beyrouth</strong> · 4 Esp. Gal de Gaulle, 92400 Courbevoie<br>
                    <a href="mailto:contact@beyrouth.express" style="color:#D4A853;text-decoration:none;">contact@beyrouth.express</a> ·
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
      subject: `Commande ${order.numero} validée · Retrait ${subjectPickup} - A Beyrouth`,
      html: emailHtml,
      replyTo: 'contact@beyrouth.express',
      orderId: orderId  // Pour sync auto du statut
    })

    if (!emailResult.success) {
      console.error('Erreur envoi email:', emailResult.error)
      throw new Error('Erreur envoi email')
    }

    // Marquer l'email comme envoyé
    await supabase
      .from('orders')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)

    console.log(`✅ Email de confirmation envoyé pour ${order.numero}`)

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-order-ready:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
