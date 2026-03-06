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

    // Template email (design cohérent avec les autres)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demande de devis reçue - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #000 100%); padding: 40px 20px; text-align: center;">
      <h1 style="color: #D4A853; margin: 0 0 8px 0; font-size: 32px; font-weight: 700; letter-spacing: 1px;">Beyrouth Express</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 15px; line-height: 1.5;">Service Click and Collect<br>restaurant A Beyrouth</p>
    </div>

    <!-- Success Badge -->
    <div style="text-align: center; padding: 30px 20px;">
      <div style="width: 80px; height: 80px; background: #E3F2FD; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: #2196F3;">📋</span>
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #1a1a1a;">Demande de devis bien reçue</h2>
      <p style="margin: 0; color: #666; font-size: 14px;">Merci ${name}, nous revenons vers vous sous 48h</p>
    </div>

    <!-- Info Box -->
    <div style="padding: 30px 20px;">
      <div style="background: #E3F2FD; padding: 20px; border-left: 4px solid #2196F3; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">✅ Votre demande a bien été enregistrée</p>
        <p style="margin: 0; font-size: 14px; color: #666; line-height: 1.5;">Notre équipe va étudier votre demande et vous envoyer un devis personnalisé dans les <strong>48 heures</strong>.</p>
      </div>
    </div>

    <!-- Recap -->
    <div style="padding: 0 20px 30px 20px; background: #fafafa;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Récapitulatif de votre demande</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${eventType ? `
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Type d'événement :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${eventType}</td>
        </tr>
        ` : ''}
        ${guestCount ? `
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Nombre de personnes :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${guestCount}</td>
        </tr>
        ` : ''}
        ${eventDate ? `
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Date souhaitée :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${eventDate}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Email :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${email}</td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Téléphone :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${phone}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${message ? `
    <!-- Message -->
    <div style="padding: 0 20px 30px 20px;">
      <div style="background: #FFF8F0; padding: 15px; border-left: 4px solid #D4A853; border-radius: 4px;">
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Votre message</p>
        <p style="margin: 0; color: #1a1a1a; font-size: 14px; line-height: 1.5;">${message}</p>
      </div>
    </div>
    ` : ''}

    <!-- Contact Box -->
    <div style="padding: 0 20px 30px 20px;">
      <div style="background: #FFF8F0; padding: 20px; border-left: 4px solid #D4A853; border-radius: 4px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">📞 Besoin d'informations ?</p>
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #666;">Vous pouvez nous joindre au restaurant :</p>
        <p style="margin: 0; font-size: 14px; color: #1a1a1a; font-weight: 600;">4 Esplanade du Général de Gaulle, 92400 Courbevoie</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #1a1a1a; padding: 30px 20px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.6); font-size: 13px;">À bientôt chez A Beyrouth !</p>
      <p style="margin: 0; color: rgba(255,255,255,0.4); font-size: 12px;">4 Esplanade du Général de Gaulle, 92400 Courbevoie</p>
      <div style="margin-top: 20px;">
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; font-size: 13px;">beyrouth.express</a>
      </div>
    </div>
  </div>
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
        from: 'A Beyrouth <noreply@beyrouth.express>',
        to: email,
        subject: '📋 Demande de devis bien reçue - A Beyrouth',
        html: emailHtml
      })
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Erreur envoi email:', emailResult)
      throw new Error('Erreur envoi email')
    }

    console.log(`✅ Email de confirmation devis envoyé à ${email}`)

    // Optionnel : Sauvegarder la demande dans une table "quotes" (à créer)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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
