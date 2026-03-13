// Template email sobre unifié pour Beyrouth Express
// Design minimaliste blanc avec TVA

export interface EmailData {
  numero: string
  heureRetrait?: string
  items: Array<{
    nom: string
    quantite: number
    prix: number
    supplements?: Array<{ nom: string; prix: number }>
  }>
  total: number
  note?: string
}

export function generateSobreEmail(type: 'confirmation' | 'payment' | 'reminder', data: EmailData): string {
  // Calcul TVA 10%
  const totalTTC = data.total
  const totalHT = totalTTC / 1.10
  const tva = totalTTC - totalHT

  // Items HTML
  const itemsHtml = data.items.map((item) => {
    let html = `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 12px 0; font-size: 14px; color: #1a1a1a;">${item.quantite}× ${item.nom}</td>
        <td style="padding: 12px 0; text-align: right; font-size: 14px; color: #1a1a1a; font-weight: 500;">${(item.prix * item.quantite).toFixed(2)}€</td>
      </tr>
    `

    // Suppléments
    if (item.supplements && item.supplements.length > 0) {
      item.supplements.forEach((supp) => {
        html += `
          <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 8px 0 8px 20px; font-size: 13px; color: #666;">+ ${supp.nom}</td>
            <td style="padding: 8px 0; text-align: right; font-size: 13px; color: #666;">${supp.prix.toFixed(2)}€</td>
          </tr>
        `
      })
    }

    return html
  }).join('')

  // Titres selon le type
  const titles = {
    confirmation: { main: 'Commande confirmée', sub: 'Votre commande a été acceptée et sera prête pour le retrait.' },
    payment: { main: 'Paiement confirmé', sub: 'Votre paiement a bien été enregistré.' },
    reminder: { main: 'Votre commande vous attend', sub: 'Rappel : votre commande est prête au retrait.' }
  }

  const { main, sub } = titles[type]

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${main} - Beyrouth Express</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">

    <!-- Header sobre -->
    <div style="padding: 32px 24px; border-bottom: 1px solid #e0e0e0;">
      <div style="font-size: 24px; font-weight: 600; color: #1a1a1a; letter-spacing: -0.5px;">Beyrouth Express</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">Click & Collect · A Beyrouth</div>
    </div>

    <!-- Titre principal -->
    <div style="padding: 32px 24px 24px 24px;">
      <div style="font-size: 22px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">${main}</div>
      <div style="font-size: 14px; color: #666; line-height: 1.5;">${sub}</div>
    </div>

    ${type === 'payment' ? `
    <!-- Info paiement en attente -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background: #fafafa; border-left: 3px solid #D4A853; padding: 16px 20px; border-radius: 2px;">
        <div style="font-size: 14px; color: #1a1a1a; line-height: 1.6; margin-bottom: 12px;">
          Votre commande est en attente de validation par le restaurant.
        </div>
        <div style="font-size: 13px; color: #666; line-height: 1.5;">
          Vous recevrez un second email de confirmation avec l'heure de retrait dès que le restaurant aura accepté votre commande.
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Info principale -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background: #fafafa; border-left: 3px solid #D4A853; padding: 16px 20px; border-radius: 2px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Numéro de commande</div>
        <div style="font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; color: #1a1a1a; letter-spacing: 2px;">${data.numero}</div>
        ${data.heureRetrait ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
          <div style="font-size: 13px; color: #888; margin-bottom: 4px;">Heure de retrait</div>
          <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">${data.heureRetrait}</div>
        </div>
        ` : ''}
      </div>
    </div>

    ${type !== 'payment' ? `
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
    ` : `
    <!-- Montant pour email paiement -->
    <div style="padding: 0 24px 32px 24px;">
      <div style="font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Montant</div>
      <div style="font-size: 24px; font-weight: 700; color: #1a1a1a;">${totalTTC.toFixed(2)}€</div>
      <div style="font-size: 13px; color: #888; margin-top: 4px;">TTC (dont TVA 10% : ${tva.toFixed(2)}€)</div>
    </div>
    `}

    ${data.note ? `
    <!-- Note -->
    <div style="padding: 0 24px 24px 24px;">
      <div style="background: #fafafa; border-left: 3px solid #D4A853; padding: 16px 20px; border-radius: 2px;">
        <div style="font-size: 13px; color: #888; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Note</div>
        <div style="font-size: 14px; color: #1a1a1a; line-height: 1.5;">${data.note}</div>
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
}
