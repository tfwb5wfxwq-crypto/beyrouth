// Edge Function publique pour envoyer un email de test
// Utilisée par le mode test (?test=1) pour tester l'envoi d'emails sans payer
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderNum } = await req.json()

    if (!orderNum) {
      return new Response(
        JSON.stringify({ error: 'orderNum requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Connexion Supabase avec service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande avec ses items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*, menu_items(nom, prix, image_url))')
      .eq('numero', orderNum)
      .single()

    if (orderError || !order) {
      console.error('Commande non trouvée:', orderError)
      return new Response(
        JSON.stringify({ error: 'Commande non trouvée' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater les items pour l'email
    const items = order.order_items.map((item: any) => ({
      nom: item.menu_items.nom,
      qty: item.quantite,
      prix: item.menu_items.prix,
      image: item.menu_items.image_url
    }))

    // Générer le HTML de l'email
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">
          <div style="font-weight:600;">${item.qty}x ${item.nom}</div>
        </td>
        <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right;">
          ${(item.prix * item.qty).toFixed(2).replace('.', ',')} €
        </td>
      </tr>
    `).join('')

    const pickupText = order.heure_retrait === 'asap' ? 'Dès que possible' : order.heure_retrait

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #f7f7f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: #1A1A1A; color: white; padding: 32px 24px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">🧆</div>
      <h1 style="margin: 0; font-size: 26px;">Beyrouth Express</h1>
      <p style="margin: 8px 0 0; opacity: 0.7; font-size: 13px;">Reçu de commande</p>
    </div>
    <div style="padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: #E8F5EC; color: #1B8C3E; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">✓</div>
        <h2 style="margin: 0 0 8px; font-size: 20px;">Commande confirmée</h2>
        <p style="margin: 0; color: #6B6B6B; font-size: 14px;">Numéro de commande</p>
        <p style="margin: 8px 0 0; font-size: 32px; font-weight: 700; color: #1A1A1A; letter-spacing: 2px;">${order.numero}</p>
      </div>
      <div style="background: #F7F7F5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #ABABAB;">Vos informations</p>
        <p style="margin: 0; font-size: 15px;"><strong>Nom :</strong> ${order.client_nom}</p>
        <p style="margin: 8px 0 0; font-size: 15px;"><strong>Heure de retrait :</strong> ${pickupText}</p>
        <p style="margin: 8px 0 0; font-size: 15px;"><strong>Lieu :</strong> <a href="https://maps.google.com/?q=4+Esplanade+du+Général+de+Gaulle,+92400+Courbevoie" style="color: #1B8C3E; text-decoration: none;">La Défense — Sortie 4 Métro 📍</a></p>
      </div>
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #ABABAB;">Détail de la commande</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
          <tr>
            <td style="padding: 16px 0 0; font-weight: 600; font-size: 16px;">Total</td>
            <td style="padding: 16px 0 0; text-align: right; font-weight: 700; font-size: 18px;">${order.total.toFixed(2).replace('.', ',')} €</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #EAEAE8;">
        <p style="margin: 0; font-size: 14px; color: #1A1A1A; font-weight: 600;">À tout de suite ! 👋</p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #6B6B6B;">Présentez votre numéro de commande au retrait</p>
      </div>
    </div>
    <div style="background: #1A1A1A; color: white; padding: 20px 24px; text-align: center; font-size: 12px; opacity: 0.7;">
      <p style="margin: 0;">Restaurant A Beyrouth — Cuisine libanaise</p>
      <p style="margin: 4px 0 0;">4 Esplanade du Général de Gaulle, 92400 Courbevoie</p>
    </div>
  </div>
</body>
</html>
    `

    // Envoyer via Resend directement
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY manquante')
      return new Response(
        JSON.stringify({ error: 'Configuration email manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Beyrouth Express <commande@beyrouth.express>',
        to: [order.client_email],
        subject: `✅ Commande ${order.numero} confirmée — Beyrouth Express`,
        html: emailHtml,
      }),
    })

    if (!emailRes.ok) {
      const errorText = await emailRes.text()
      console.error('Erreur Resend:', errorText)
      return new Response(
        JSON.stringify({ error: 'Erreur Resend', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailData = await emailRes.json()
    console.log('✅ Email test envoyé à', order.client_email, '- Message ID:', emailData.id)

    return new Response(
      JSON.stringify({
        success: true,
        email: order.client_email,
        messageId: emailData.messageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erreur send-test-receipt:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
