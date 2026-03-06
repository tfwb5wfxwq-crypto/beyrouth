// Edge Function: Envoyer email de confirmation quand commande est acceptée
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    // Construire le récapitulatif des items
    const itemsHtml = order.items.map((item: any) => {
      let html = `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          ${item.quantite}x ${item.nom}
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
          ${(item.prix * item.quantite).toFixed(2).replace('.', ',')} €
        </td>
      </tr>
      `

      // Ajouter les suppléments si présents
      if (item.supplements && item.supplements.length > 0) {
        item.supplements.forEach((supp: any) => {
          html += `
      <tr>
        <td style="padding: 4px 0 4px 20px; border-bottom: 1px solid #eee; font-size: 13px; color: #666;">
          + ${supp.nom}
        </td>
        <td style="padding: 4px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 13px; color: #666;">
          ${supp.prix.toFixed(2).replace('.', ',')} €
        </td>
      </tr>
          `
        })
      }

      return html
    }).join('')

    // Formater l'heure de retrait
    const pickupText = order.heure_retrait || 'Dès que possible'

    // Template email (design original noir et or)
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commande confirmée - A Beyrouth</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #000 100%); padding: 40px 20px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🧆</div>
      <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 700;">A Beyrouth</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 16px;">Reçu de commande</p>
    </div>

    <!-- Success Badge -->
    <div style="text-align: center; padding: 30px 20px;">
      <div style="width: 80px; height: 80px; background: #E8F5E9; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="font-size: 40px; color: #4CAF50;">✓</span>
      </div>
      <h2 style="margin: 0 0 10px 0; font-size: 24px; color: #1a1a1a;">Commande confirmée</h2>
      <p style="margin: 0; color: #666; font-size: 14px;">Nous préparons votre commande avec soin</p>
    </div>

    <!-- Order Number -->
    <div style="background: #FFF8F0; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
      <div>
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Numéro de commande</p>
        <p style="margin: 0; font-size: 48px; font-weight: 700; color: #4CAF50; font-family: 'Courier New', monospace; letter-spacing: 8px;">${order.numero}</p>
        <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">Présentez ce numéro lors du retrait</p>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="padding: 30px 20px; background: #fafafa;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Vos informations</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Nom :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${order.client_prenom}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Heure de retrait :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${pickupText}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Lieu :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">La Défense — Sortie 4 Métro</td>
        </tr>
      </table>
    </div>

    <!-- Order Items -->
    <div style="padding: 30px 20px;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Détail de la commande</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
        <tr>
          <td style="padding: 15px 0 0 0; font-weight: 700; font-size: 16px; color: #1a1a1a;">Total</td>
          <td style="padding: 15px 0 0 0; font-weight: 700; font-size: 16px; text-align: right; color: #1a1a1a;">${order.total.toFixed(2).replace('.', ',')} €</td>
        </tr>
      </table>
    </div>

    ${order.note ? `
    <!-- Note -->
    <div style="padding: 0 20px 30px 20px;">
      <div style="background: #FFF8F0; padding: 15px; border-left: 4px solid #D4A853; border-radius: 4px;">
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Votre note</p>
        <p style="margin: 0; color: #1a1a1a; font-size: 14px;">${order.note}</p>
      </div>
    </div>
    ` : ''}

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
        to: order.client_email,
        subject: `✅ Commande ${order.numero} confirmée`,
        html: emailHtml
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
