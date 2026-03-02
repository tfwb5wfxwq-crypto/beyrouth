import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const { email, name, orderNum, codeRetrait, items, total, pickup } = await req.json()

    // Construire le HTML de l'email
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          ${item.qty}x ${item.nom}
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">
          ${(item.prix * item.qty).toFixed(2).replace('.', ',')} €
        </td>
      </tr>
    `).join('')

    const pickupText = pickup === 'asap' ? 'Dès que possible' : pickup

    const html = `
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

    <!-- Order Number & Code -->
    <div style="background: #FFF8F0; padding: 30px 20px; text-align: center; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Numéro de commande</p>
        <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1a1a1a; font-family: 'Courier New', monospace;">${orderNum}</p>
      </div>
      <div>
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Code de retrait</p>
        <p style="margin: 0; font-size: 48px; font-weight: 700; color: #4CAF50; font-family: 'Courier New', monospace; letter-spacing: 8px;">${codeRetrait}</p>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="padding: 30px 20px; background: #fafafa;">
      <h3 style="margin: 0 0 15px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Vos informations</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; font-size: 14px;"><strong>Nom :</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #1a1a1a; font-size: 14px;">${name}</td>
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
          <td style="padding: 15px 0 0 0; font-weight: 700; font-size: 16px; text-align: right; color: #1a1a1a;">${total.toFixed(2).replace('.', ',')} €</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="background: #1a1a1a; padding: 30px 20px; text-align: center;">
      <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.6); font-size: 13px;">À bientôt chez A Beyrouth !</p>
      <p style="margin: 0; color: rgba(255,255,255,0.4); font-size: 12px;">1 Esplanade du Général de Gaulle, 92800 Puteaux</p>
      <div style="margin-top: 20px;">
        <a href="https://beyrouth.express" style="color: #D4A853; text-decoration: none; font-size: 13px;">beyrouth.express</a>
      </div>
    </div>
  </div>
</body>
</html>
    `

    // Envoyer via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'A Beyrouth <noreply@beyrouth.express>',
        to: [email],
        subject: `✅ Commande ${orderNum} confirmée — Code retrait: ${codeRetrait}`,
        html
      })
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Erreur Resend')
    }

    return new Response(JSON.stringify({ success: true, messageId: data.id }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Erreur envoi email:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
