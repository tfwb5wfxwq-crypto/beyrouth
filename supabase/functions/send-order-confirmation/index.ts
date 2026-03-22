// Edge Function: Envoyer email de confirmation quand commande est acceptée
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
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 12px 0; font-size: 14px; color: #1a1a1a;">${qty}× ${name}</td>
        <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1a1a1a; font-weight: 500;">${(price * qty).toFixed(2)}€</td>
      </tr>
      `

      // Ajouter les suppléments si présents
      if (item.supplements && item.supplements.length > 0) {
        item.supplements.forEach((supp: any) => {
          const suppName = supp.name || supp.nom || 'Supplément'
          const suppPrice = supp.price || supp.prix || 0
          html += `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 8px 0 8px 20px; font-size: 13px; color: #666;">+ ${suppName}</td>
        <td style="padding: 8px 0; text-align: right; font-size: 13px; color: #666;">${suppPrice.toFixed(2)}€</td>
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

    // Template email (design sobre)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande confirmée - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">

    <!-- Header avec logo -->
    <div style="padding: 32px 24px; border-bottom: 1px solid #e0e0e0; text-align: center;">
      <div style="background: #1a1a1a; border-radius: 12px; padding: 20px; display: inline-block; margin-bottom: 12px;">
        <div style="display: inline-flex; align-items: center; gap: 12px;">
          <img src="https://beyrouth.express/img/logo-olives.svg" alt="Falafels" style="height: 50px; width: auto; vertical-align: middle;">
          <img src="https://beyrouth.express/img/logo-text.svg" alt="Beyrouth Express" style="height: 45px; width: auto; vertical-align: middle;">
        </div>
      </div>
      <div style="font-size: 13px; color: #666; margin-top: 12px;">Retrait · Restaurant Libanais La Défense</div>
    </div>

    <!-- Titre principal -->
    <div style="padding: 32px 24px 24px 24px;">
      <div style="font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">Commande confirmée</div>
      <div style="font-size: 14px; color: #666; line-height: 1.5;">Votre commande a été acceptée et sera prête pour le retrait.</div>
    </div>

    <!-- Info principale -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background: #fafafa; border-left: 3px solid #D4A853; padding: 16px 20px; border-radius: 2px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Numéro de commande</div>
        <div style="font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; color: #1a1a1a; letter-spacing: 2px;">${order.numero}</div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
          <div style="font-size: 13px; color: #888; margin-bottom: 4px;">Heure de retrait</div>
          <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${pickupText}</div>
        </div>
      </div>
    </div>

    <!-- Récapitulatif commande -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Détail de votre commande</div>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
        <tr style="border-top: 1px solid #f0f0f0;">
          <td style="padding: 12px 0; font-size: 13px; color: #888;">Total HT</td>
          <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1a1a1a;">${totalHT.toFixed(2)}€</td>
        </tr>
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 8px 0; font-size: 13px; color: #888;">TVA 10%</td>
          <td style="padding: 8px 0; text-align: right; font-size: 14px; color: #1a1a1a;">${tva.toFixed(2)}€</td>
        </tr>
        <tr style="border-top: 2px solid #1a1a1a;">
          <td style="padding: 16px 0 0 0; font-size: 16px; color: #1a1a1a; font-weight: 600;">Total TTC</td>
          <td style="padding: 16px 0 0 0; text-align: right; font-size: 18px; color: #1a1a1a; font-weight: 700;">${totalTTC.toFixed(2)}€</td>
        </tr>
      </table>
    </div>

    ${order.note && order.note.trim() ? `
    <!-- Note client -->
    <div style="padding: 0 24px 20px 24px;">
      <div style="background: #fef2f2; border-left: 3px solid #f87171; padding: 14px 18px; border-radius: 6px;">
        <div style="font-size: 12px; color: #991b1b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Votre note</div>
        <div style="font-size: 14px; color: #7f1d1d; line-height: 1.5;">${order.note.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
    </div>
    ` : ''}

    <!-- Adresse retrait -->
    <div style="padding: 0 24px 32px 24px;">
      <div style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Lieu de retrait</div>
      <div style="font-size: 14px; color: #1a1a1a; line-height: 1.6; margin-bottom: 8px;">
        <strong>A Beyrouth</strong><br>
        4 Esplanade du Général de Gaulle<br>
        92400 Courbevoie (La Défense)
      </div>
      <a href="https://maps.google.com/?q=4+Esplanade+du+Général+de+Gaulle+92400+Courbevoie" style="font-size: 14px; color: #D4A853; text-decoration: none; font-weight: 500;">→ Voir sur Google Maps</a>
    </div>

    <!-- Footer -->
    <div style="background: #fafafa; padding: 24px; border-top: 1px solid #e0e0e0; text-align: center;">
      <div style="font-size: 12px; color: #888; line-height: 1.6;">
        À bientôt chez A Beyrouth<br>
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; margin-top: 8px; display: inline-block;">beyrouth.express</a>
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
        from: 'A Beyrouth <commande@beyrouth.express>',
        to: order.client_email,
        subject: `✅ Commande ${order.numero} confirmée - A Beyrouth`,
        html: emailHtml,
        reply_to: 'contact@beyrouth.express'
      })
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Erreur envoi email:', emailResult)
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
