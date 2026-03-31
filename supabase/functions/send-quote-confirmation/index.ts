// Edge Function: Envoyer email confirmation demande de devis
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
    const { email, name, phone, message, eventType, guestCount, eventDate } = await req.json()

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: 'Email et nom requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validation anti-spam basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase pour vérifications
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Protection 1: Rate limiting (max 3 demandes par email par heure)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentRequests, error: rateLimitError } = await supabase
      .from('quote_requests')
      .select('id')
      .eq('client_email', email)
      .gte('created_at', oneHourAgo)

    if (rateLimitError) {
      console.error('Erreur rate limit check:', rateLimitError)
    }

    if (recentRequests && recentRequests.length >= 3) {
      return new Response(
        JSON.stringify({ error: 'Trop de demandes. Veuillez réessayer dans 1 heure.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Protection 2: Détection doublons récents (même email dans les 30 dernières minutes)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: duplicates, error: dupError } = await supabase
      .from('quote_requests')
      .select('id')
      .eq('client_email', email)
      .gte('created_at', thirtyMinAgo)

    if (dupError) {
      console.error('Erreur duplicate check:', dupError)
    }

    if (duplicates && duplicates.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Vous avez déjà envoyé une demande récemment.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Template email CLIENT (Gmail-compatible - tables, solid colors, no flex/gradient)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Demande de devis reçue - A Beyrouth</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;">

          <!-- Header fond noir avec logo -->
          <tr>
            <td style="background:#000;padding:8px 24px;text-align:center;">
              <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:24px 20px;">
              <div style="font-size:20px;font-weight:600;color:#1a1a1a;margin-bottom:8px;">📋 Demande de devis reçue</div>
              <div style="font-size:14px;color:#666;line-height:1.5;margin-bottom:20px;">Merci ${name.split(' ')[0]}, nous revenons vers vous sous 48h.</div>

              <!-- Info principale -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fafafa;padding:16px 20px;">
                    <div style="font-size:14px;color:#1a1a1a;font-weight:600;margin-bottom:8px;">✅ Votre demande a été enregistrée</div>
                    <div style="font-size:13px;color:#666;line-height:1.5;">
                      Notre équipe va étudier votre demande et vous envoyer un devis personnalisé dans les 48 heures.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Récapitulatif -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fafafa;padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Récapitulatif</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.8;">
                      ${eventType ? `<div>📅 <strong>${eventType}</strong></div>` : ''}
                      ${guestCount ? `<div>👥 ${guestCount} personnes</div>` : ''}
                      ${eventDate ? `<div>📆 ${eventDate}</div>` : ''}
                      <div>📧 ${email}</div>
                      ${phone ? `<div>📱 ${phone}</div>` : ''}
                    </div>
                  </td>
                </tr>
              </table>

              ${message ? `
              <!-- Message -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="background:#fafafa;padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Votre message</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap;">${message}</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Contact -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e0e0e0;">
                <tr>
                  <td style="padding:16px 0;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">📍 Contact</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.5;">
                      <strong>A Beyrouth</strong><br>
                      4 Esplanade du Général de Gaulle<br>
                      92400 Courbevoie (La Défense)
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:32px 24px;border-top:1px solid #e0e0e0;">

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

    // Envoyer l'email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'A Beyrouth <traiteur@beyrouth.express>',
        to: email,
        subject: '📋 Demande de devis bien reçue - A Beyrouth',
        html: emailHtml
      })
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Erreur envoi email client:', emailResult)
      throw new Error('Erreur envoi email client')
    }

    console.log(`✅ Email de confirmation devis envoyé à ${email}`)

    // Envoyer aussi un email à l'admin avec les détails (Gmail-compatible - tables, solid colors, no flex/gradient)
    const adminEmailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Nouvelle demande de devis - ${name}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;">

          <!-- Header fond noir avec logo -->
          <tr>
            <td style="background:#000;padding:8px 24px;text-align:center;">
              <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:24px 20px;">
              <div style="font-size:20px;font-weight:600;color:#1a1a1a;margin-bottom:16px;">🆕 Nouvelle demande de devis</div>

              <!-- Contact -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:#fafafa;padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Contact</div>
                    <div style="font-size:16px;color:#1a1a1a;font-weight:600;margin-bottom:8px;">${name}</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.8;">
                      📧 <a href="mailto:${email}" style="color:#1a1a1a;text-decoration:none;">${email}</a><br>
                      ${phone ? `📱 <a href="tel:${phone}" style="color:#1a1a1a;text-decoration:none;">${phone}</a>` : ''}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Événement -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:#fafafa;padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Événement</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.8;">
                      ${eventType ? `<div>📅 <strong>${eventType}</strong></div>` : ''}
                      ${guestCount ? `<div>👥 <strong>${guestCount} personnes</strong></div>` : ''}
                      ${eventDate ? `<div>📆 ${eventDate}</div>` : ''}
                    </div>
                  </td>
                </tr>
              </table>

              ${message ? `
              <!-- Message -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:#fafafa;padding:16px 20px;">
                    <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Message</div>
                    <div style="font-size:14px;color:#1a1a1a;line-height:1.6;white-space:pre-wrap;">${message}</div>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Info -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#E3F2FD;padding:12px 16px;">
                    <div style="font-size:13px;color:#1565C0;font-weight:600;">✉️ Email de confirmation envoyé au client</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:20px;border-top:1px solid #e0e0e0;text-align:center;">
              <div style="font-size:12px;color:#888;">Demande enregistrée dans quote_requests</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    const adminEmailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'A Beyrouth <traiteur@beyrouth.express>',
        to: 'traiteur@beyrouth.express',
        subject: `📋 Nouvelle demande de devis - ${name}`,
        html: adminEmailHtml
      })
    })

    const adminEmailResult = await adminEmailResponse.json()

    if (!adminEmailResponse.ok) {
      console.error('Erreur envoi email admin:', adminEmailResult)
      // On ne throw pas l'erreur car l'email client a été envoyé
    } else {
      console.log(`✅ Email admin envoyé à traiteur@beyrouth.express`)
    }

    // Sauvegarder la demande dans la table quote_requests
    await supabase.from('quote_requests').insert({
      client_name: name,
      client_email: email,
      client_phone: phone,
      event_type: eventType,
      guest_count: guestCount,
      event_date: eventDate,
      message: message,
      status: 'pending',
      created_at: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erreur send-quote-confirmation:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
