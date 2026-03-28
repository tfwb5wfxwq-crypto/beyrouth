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

    // Formater l'heure de retrait (convertir "asap" en texte clair)
    let pickupText = order.heure_retrait || 'Dès que possible'
    if (pickupText === 'asap' || pickupText === 'ASAP') {
      pickupText = 'Dès que possible'
    }

    // Calculer TVA (10% restauration)
    const totalTTC = order.total
    const totalHT = totalTTC / 1.10
    const tva = totalTTC - totalHT

    // Template email (design uniforme et moderne)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande confirmée</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">

    <!-- Header fond noir avec logo -->
    <div style="background:#000;padding:8px 24px;text-align:center;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:240px;height:auto;max-width:100%;">
    </div>

    <!-- Contenu principal -->
    <div style="padding:24px 20px;">

      <!-- Statut -->
      <div style="background:#f0fdf4;border-left:3px solid #22c55e;padding:16px 20px;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:600;color:#166534;">✅ Commande confirmée</div>
      </div>

      <!-- Numéro + Heure -->
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

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        ${itemsHtml}
        <tr style="border-top:2px solid #1a1a1a;">
          <td style="padding:14px 0 0 0;font-size:16px;font-weight:600;color:#1a1a1a;">Total TTC</td>
          <td style="padding:14px 0 0 0;text-align:right;font-size:18px;font-weight:700;color:#1a1a1a;">${totalTTC.toFixed(2)}€</td>
        </tr>
      </table>

      ${order.note && order.note.trim() ? `
      <!-- Note -->
      <div style="background:#fef2f2;border-left:3px solid #f87171;padding:14px 18px;margin-bottom:20px;border-radius:6px;">
        <div style="font-size:12px;color:#991b1b;font-weight:600;text-transform:uppercase;margin-bottom:6px;">Note</div>
        <div style="font-size:14px;color:#7f1d1d;line-height:1.5;">${order.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
      ` : ''}

      <!-- Adresse -->
      <div style="padding:16px 0;border-top:1px solid #e0e0e0;">
        <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">📍 Retrait</div>
        <div style="font-size:14px;color:#1a1a1a;line-height:1.5;margin-bottom:12px;">
          <strong>A Beyrouth</strong> · 4 Esp. Gal de Gaulle<br>
          92400 Courbevoie (La Défense)<br>
          <span style="font-size:12px;color:#888;">Sortie 4 du métro La Défense</span>
        </div>
        <a href="https://www.google.com/maps/search/A+Beyrouth+4+Esplanade+du+General+de+Gaulle+92400+Courbevoie" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#E65100;color:#fff;text-decoration:none;padding:9px 20px;border-radius:7px;font-weight:600;font-size:13px;box-shadow:0 2px 4px rgba(230,81,0,0.25);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          Ouvrir dans Google Maps
        </a>
      </div>

    </div>

    <!-- Footer uniforme avec CTA avis Google -->
    <div style="background:#fafafa;padding:32px 24px;border-top:1px solid #e0e0e0;">
      <!-- CTA Google (bleu doux) -->
      <div style="background:linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center;">
        <div style="font-size:20px;margin-bottom:6px;">⭐⭐⭐⭐⭐</div>
        <div style="font-size:14px;font-weight:700;color:#1565C0;margin-bottom:4px;">Votre avis compte !</div>
        <div style="font-size:12px;color:#1976D2;margin-bottom:12px;line-height:1.4;">
          Mettez-nous 5 étoiles sur Google 🙏
        </div>
        <a href="https://maps.app.goo.gl/mKChLAAquBDL2C5c6" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#1976D2;color:#fff;text-decoration:none;padding:9px 20px;border-radius:7px;font-weight:600;font-size:13px;box-shadow:0 2px 4px rgba(25,118,210,0.2);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/></svg>
          Laisser un avis
        </a>
      </div>

      <!-- Instagram -->
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:13px;color:#888;margin-bottom:12px;">Suivez-nous</div>
        <a href="https://www.instagram.com/a_beyrouth/" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%);color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:13px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          @a_beyrouth
        </a>
      </div>

      <!-- Contact -->
      <div style="text-align:center;font-size:12px;color:#888;line-height:1.6;">
        <strong style="color:#1a1a1a;">A Beyrouth</strong> · 4 Esp. Gal de Gaulle, 92400 Courbevoie<br>
        <a href="mailto:contact@beyrouth.express" style="color:#D4A853;text-decoration:none;">contact@beyrouth.express</a> ·
        <a href="https://beyrouth.express" style="color:#D4A853;text-decoration:none;">beyrouth.express</a>
      </div>
    </div>

  </div>
</body>
</html>
    `

    // Envoyer l'email via Brevo API
    const emailResult = await sendEmailViaBrevo({
      to: order.client_email,
      subject: `✅ Commande ${order.numero} confirmée - A Beyrouth`,
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
