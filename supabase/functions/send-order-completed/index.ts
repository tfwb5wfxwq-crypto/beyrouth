// Edge Function: Envoyer email après récupération commande (avec lien facture + avis)
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

    // Accepter soit service_role (webhook interne), soit JWT admin Supabase Auth
    const isServiceRole = token === serviceRoleKey

    if (!isServiceRole) {
      // 🔒 Valider le JWT Supabase Auth
      const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !adminUser) {
        return new Response(
          JSON.stringify({ error: 'Token invalide ou expiré' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      console.log('✅ Appel depuis service_role (webhook)')
    }

    const { orderId, emailOverride, forceResend } = await req.json()

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

    // Vérifier que la commande est bien récupérée
    if (order.statut !== 'recuperee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas encore récupérée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email (sauf si forceResend)
    if (order.completed_email_sent_at && !forceResend) {
      console.log(`⏭️  Email de remerciement déjà envoyé pour commande ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (forceResend) {
      console.log(`🔄 Renvoi forcé de l'email pour commande ${order.numero}`)
    }

    // Liens externes (utiliser le token sécurisé)
    const invoicePdfUrl = `https://beyrouth.express/facture?token=${order.invoice_token}`
    const googleReviewUrl = 'https://maps.app.goo.gl/mKChLAAquBDL2C5c6'
    const instagramUrl = 'https://www.instagram.com/a_beyrouth/'

    // Template email (Gmail-compatible - pas de SVG, pas de gradients, pas de flexbox)
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
  <title>Merci pour votre visite !</title>
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
            <td bgcolor="#ffffff" style="background:#ffffff;padding:32px 24px;text-align:center;">
              <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#1a1a1a;">Merci pour votre visite !</h1>
              <p style="margin:0 0 24px 0;font-size:16px;color:#666;line-height:1.6;">
                Votre commande <strong>${order.numero}</strong> a bien été récupérée.<br>
                À très bientôt chez A Beyrouth !
              </p>

              <!-- Bouton Facture PDF -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:16px 0;">
                    <a href="${invoicePdfUrl}" target="_blank" style="display:inline-block;background:#2C3E50;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;">
                      📄 Télécharger mon reçu
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer avec CTA -->
          <tr>
            <td bgcolor="#f5f5f5" style="background:#f5f5f5;padding:32px 24px;border-top:1px solid #e0e0e0;">

              <!-- CTA Google (couleur solide au lieu de gradient) -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#E3F2FD;border-radius:10px;padding:20px;text-align:center;">
                    <div style="font-size:24px;margin-bottom:8px;">⭐⭐⭐⭐⭐</div>
                    <div style="font-size:15px;font-weight:700;color:#1565C0;margin-bottom:6px;">Votre avis compte !</div>
                    <div style="font-size:13px;color:#1976D2;margin-bottom:16px;line-height:1.5;">
                      Mettez-nous 5 étoiles sur Google 🙏
                    </div>
                    <a href="${googleReviewUrl}" target="_blank" style="display:inline-block;background:#1976D2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
                      🌟 Laisser un avis
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instagram -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center" style="font-size:12px;color:#aaa;letter-spacing:0.5px;text-transform:uppercase;padding-bottom:8px;">Retrouvez-nous sur</td>
                </tr>
                <tr>
                  <td align="center">
                    <a href="${instagramUrl}" target="_blank" style="display:inline-block;background:#fafafa;color:#1a1a1a;text-decoration:none;padding:10px 28px;border-radius:20px;font-weight:600;font-size:14px;border:1px solid #e0e0e0;letter-spacing:0.3px;">
                      @a_beyrouth
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Adresse -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;font-size:13px;color:#888;line-height:1.6;">
                    <strong style="color:#1a1a1a;">A Beyrouth</strong><br>
                    4 Esp. Gal de Gaulle, 92400 Courbevoie<br>
                    <a href="https://beyrouth.express" style="color:#D4A853;text-decoration:none;margin-top:8px;display:inline-block;">beyrouth.express</a>
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
    // emailOverride permet à Paco de renvoyer à une autre adresse (si client s'est trompé)
    const emailResult = await sendEmailViaBrevo({
      to: emailOverride || order.client_email,
      subject: `Merci pour votre visite - Commande ${order.numero} - A Beyrouth`,
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
      .update({ completed_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)

    console.log(`✅ Email de remerciement envoyé pour ${order.numero}`)

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-order-completed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
