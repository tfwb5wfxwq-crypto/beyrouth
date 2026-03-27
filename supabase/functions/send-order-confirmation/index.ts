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

    // Template email (design équilibré)
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

    <!-- Header -->
    <div style="padding:24px 20px;text-align:center;border-bottom:1px solid #e0e0e0;">
      <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:180px;height:auto;margin:0 auto;">
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
        <div style="font-size:14px;color:#1a1a1a;line-height:1.5;">
          <strong>A Beyrouth</strong> · 4 Esp. Gal de Gaulle<br>
          92400 Courbevoie (La Défense)
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
