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

    // Vérifier que la commande est bien récupérée
    if (order.statut !== 'recuperee') {
      return new Response(
        JSON.stringify({ error: 'Commande pas encore récupérée' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.completed_email_sent_at) {
      console.log(`⏭️  Email de remerciement déjà envoyé pour commande ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Liens externes
    const trackingUrl = `https://beyrouth.express/commande.html?numero=${order.numero}&action=facture`
    const googleReviewUrl = 'https://maps.app.goo.gl/mKChLAAquBDL2C5c6'
    const instagramUrl = 'https://www.instagram.com/a_beyrouth/'

    // Template email (design épuré)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Merci pour votre visite !</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">

    <!-- Header -->
    <div style="padding:24px 20px;text-align:center;border-bottom:1px solid #e0e0e0;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:180px;height:auto;margin:0 auto;">
    </div>

    <!-- Contenu principal -->
    <div style="padding:32px 24px;text-align:center;">

      <!-- Emoji + Message -->
      <div style="font-size:48px;margin-bottom:16px;">🧆</div>
      <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#1a1a1a;">Merci pour votre visite !</h1>
      <p style="margin:0 0 24px 0;font-size:16px;color:#666;line-height:1.6;">
        Votre commande <strong>${order.numero}</strong> a bien été récupérée.<br>
        À très bientôt chez A Beyrouth !
      </p>

      <!-- Boutons CTA -->
      <div style="margin:32px 0;">

        <!-- Facture PDF -->
        <a href="${trackingUrl}" style="display:inline-block;background:#D4A853;color:#1a1a1a;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:15px;margin-bottom:12px;">
          📄 Télécharger mon ticket de caisse
        </a>

        <!-- Google Reviews -->
        <div style="margin-top:16px;">
          <a href="${googleReviewUrl}" style="display:inline-block;background:#fff;border:2px solid #e0e0e0;color:#1a1a1a;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">
            ⭐ Donnez votre avis sur Google
          </a>
        </div>

        <!-- Instagram -->
        <div style="margin-top:12px;">
          <a href="${instagramUrl}" style="display:inline-block;background:#fff;border:2px solid #e0e0e0;color:#1a1a1a;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">
            📸 Suivez-nous sur Instagram
          </a>
        </div>

      </div>

      <!-- Adresse -->
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e0e0e0;">
        <div style="font-size:14px;color:#888;line-height:1.6;">
          <strong style="color:#1a1a1a;">A Beyrouth</strong><br>
          4 Esplanade du Général de Gaulle<br>
          92400 Courbevoie (La Défense)<br>
          Métro : La Défense (lignes 1, A, T2)
        </div>
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
      subject: `Merci pour votre visite ! 🧆 - A Beyrouth`,
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
