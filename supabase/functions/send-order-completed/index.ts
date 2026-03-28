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

    const { orderId, emailOverride } = await req.json()

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

    // Vérifier qu'on n'a pas déjà envoyé l'email
    if (order.completed_email_sent_at) {
      console.log(`⏭️  Email de remerciement déjà envoyé pour commande ${order.numero}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Email déjà envoyé' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Liens externes (utiliser le token sécurisé)
    const invoicePdfUrl = `https://beyrouth.express/facture?token=${order.invoice_token}`
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

      <!-- Message (sans emoji falafel car déjà dans logo) -->
      <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#1a1a1a;">Merci pour votre visite !</h1>
      <p style="margin:0 0 24px 0;font-size:16px;color:#666;line-height:1.6;">
        Votre commande <strong>${order.numero}</strong> a bien été récupérée.<br>
        À très bientôt chez A Beyrouth !
      </p>

      <!-- Boutons CTA -->
      <div style="margin:32px 0;">

        <!-- Facture PDF (lien direct) -->
        <a href="${invoicePdfUrl}" target="_blank" style="display:inline-block;background:#D4A853;color:#1a1a1a;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px;margin-bottom:12px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          📄 Télécharger mon ticket de caisse
        </a>

        <!-- Google Reviews avec icône SVG -->
        <div style="margin-top:16px;">
          <a href="${googleReviewUrl}" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#fff;border:2px solid #4285F4;color:#4285F4;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;transition:all 0.2s;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Donnez votre avis sur Google
          </a>
        </div>

        <!-- Instagram avec icône SVG -->
        <div style="margin-top:12px;">
          <a href="${instagramUrl}" target="_blank" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Suivez-nous sur Instagram
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
    // emailOverride permet à Paco de renvoyer à une autre adresse (si client s'est trompé)
    const emailResult = await sendEmailViaBrevo({
      to: emailOverride || order.client_email,
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
