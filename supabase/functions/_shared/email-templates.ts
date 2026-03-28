// Templates email uniformisés pour A Beyrouth
// Header, footer et structure cohérents pour tous les emails

// 🎨 HEADER UNIFORME (encart noir réduit)
export const emailHeader = `
<div style="background:#000;padding:20px 24px;text-align:center;">
  <img src="https://beyrouth.express/img/logo-email-final.png" alt="A Beyrouth" style="width:180px;height:auto;max-width:100%;">
</div>
`

// 🎯 FOOTER UNIFORME (avec appel avis Google + réseaux)
export const emailFooter = `
<div style="background:#fafafa;padding:32px 24px;border-top:1px solid #e0e0e0;">
  <!-- CTA Avis Google -->
  <div style="background:#fff;border:2px solid #4285F4;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
    <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">⭐ Votre avis compte !</div>
    <div style="font-size:13px;color:#666;margin-bottom:16px;line-height:1.5;">
      Votre retour nous aide énormément.<br>
      Mettez-nous 5 étoiles sur Google si vous avez aimé votre expérience ! 🙏
    </div>
    <a href="https://maps.app.goo.gl/mKChLAAquBDL2C5c6" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#4285F4;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/></svg>
      Laisser un avis sur Google
    </a>
  </div>

  <!-- Réseaux sociaux -->
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
`

// 📧 WRAPPER COMPLET
export function wrapEmail(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>A Beyrouth</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;">
    ${emailHeader}
    ${content}
    ${emailFooter}
  </div>
</body>
</html>
  `.trim()
}

// 🎨 STYLES COMMUNS
export const commonStyles = {
  // Numéro de commande
  orderNumber: `font-size:24px;font-weight:700;font-family:'Courier New',monospace;color:#1a1a1a;letter-spacing:1px;`,

  // Badges de statut
  statusSuccess: `background:#f0fdf4;border-left:3px solid #22c55e;padding:16px 20px;border-radius:4px;`,
  statusWarning: `background:#fef3c7;border-left:3px solid:#f59e0b;padding:16px 20px;border-radius:4px;`,
  statusError: `background:#fef2f2;border-left:3px solid #dc2626;padding:16px 20px;border-radius:4px;`,

  // Cartes
  card: `background:#fafafa;padding:16px 20px;border-radius:8px;margin-bottom:16px;`,

  // Texte
  heading: `font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 12px;`,
  body: `font-size:14px;color:#666;line-height:1.6;`,
  label: `font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;`
}
