// Edge Function: Générer facture PDF
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 🔒 Fonction d'échappement XSS
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Support GET avec token sécurisé (lien direct depuis email) et POST (appel depuis frontend)
    let orderId = null
    let invoiceToken = null

    if (req.method === 'GET') {
      // GET avec invoice_token UUID (lien depuis email — token difficile à deviner)
      const url = new URL(req.url)
      invoiceToken = url.searchParams.get('token')
      if (!invoiceToken) {
        return new Response(
          JSON.stringify({ error: 'Token manquant' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // POST : réservé admin — valider JWT Supabase Auth
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Non autorisé - token admin requis' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const supabaseCheck = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      const { data: { user }, error: authError } = await supabaseCheck.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Token invalide ou expiré' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      const body = await req.json()
      orderId = body.orderId
      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'orderId requis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Connexion Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer la commande (par ID ou token)
    let query = supabase.from('orders').select('*')
    if (orderId) {
      query = query.eq('id', orderId)
    } else {
      query = query.eq('invoice_token', invoiceToken)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
      console.error('Erreur récupération commande:', orderError)
      throw new Error('Commande introuvable')
    }

    // Générer HTML de la facture (optimisé pour print-to-PDF)
    const invoiceHtml = generateInvoiceHTML(order)

    // Retourner le HTML
    return new Response(invoiceHtml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      }
    })

  } catch (error) {
    console.error('Erreur generate-invoice-pdf:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateInvoiceHTML(order: any): string {
  // Utiliser la date de génération de facture si disponible, sinon date de commande
  const invoiceDate = order.invoice_generated_at || order.created_at
  const date = new Date(invoiceDate)
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

  const invoiceNumber = order.numero

  // Calculer TVA (10% restauration)
  const totalTTC = order.total
  const totalHT = totalTTC / 1.10
  const tva = totalTTC - totalHT

  // Items HTML (avec échappement XSS)
  const itemsHtml = order.items.map((item: any) => {
    // Fallback qty vs quantite (compatibilité anciennes commandes)
    const quantite = item.quantite || item.qty || 1
    const prix = item.prix || 0
    const totalItem = prix * quantite

    let html = `
      <tr>
        <td style="padding:14px 12px; border-bottom:1px solid #eee;">${escapeHtml(item.nom)}</td>
        <td style="padding:14px 12px; border-bottom:1px solid #eee; text-align:center;">${quantite}</td>
        <td style="padding:14px 12px; border-bottom:1px solid #eee; text-align:right;">${prix.toFixed(2)}€</td>
        <td style="padding:14px 12px; border-bottom:1px solid #eee; text-align:right; font-weight:500;">${totalItem.toFixed(2)}€</td>
      </tr>
    `

    // Suppléments
    if (item.supplements && item.supplements.length > 0) {
      item.supplements.forEach((supp: any) => {
        const suppPrix = supp.prix || 0
        html += `
          <tr>
            <td style="padding:10px 12px 10px 32px; border-bottom:1px solid #eee; font-size:14px; color:#888;">+ ${escapeHtml(supp.nom)}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #eee;"></td>
            <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:right; font-size:14px; color:#888;">${suppPrix.toFixed(2)}€</td>
            <td style="padding:10px 12px; border-bottom:1px solid #eee; text-align:right; font-size:14px; color:#888;">${suppPrix.toFixed(2)}€</td>
          </tr>
        `
      })
    }

    return html
  }).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu ${escapeHtml(order.numero)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 16mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #222;
      background: #fff;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      padding: 28px 24px;
    }
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 18px;
      border-bottom: 2px solid #000;
      margin-bottom: 22px;
      gap: 12px;
    }
    .receipt-title { font-size: 22px; font-weight: 800; letter-spacing: 1.5px; color: #000; }
    .receipt-num { font-size: 13px; color: #888; margin-top: 4px; }
    .receipt-date { text-align: right; font-size: 13px; color: #444; line-height: 1.7; flex-shrink: 0; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 22px;
    }
    .info-block .lbl {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: #999; margin-bottom: 6px;
    }
    .info-block p { font-size: 13px; line-height: 1.75; color: #333; }
    .info-right { text-align: right; }
    table { width: 100%; border-collapse: collapse; margin: 0 0 18px; }
    thead th {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #999;
      padding: 7px 8px; border-bottom: 1px solid #000; text-align: left;
    }
    thead th.r { text-align: right; }
    thead th.c { text-align: center; }
    tbody td { font-size: 14px; padding: 9px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    tbody td.r { text-align: right; white-space: nowrap; }
    tbody td.c { text-align: center; }
    .totals { max-width: 230px; margin-left: auto; }
    .t-line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid #eee; }
    .t-line .lbl { color: #888; }
    .t-line .val { font-weight: 500; white-space: nowrap; }
    .t-total { border-bottom: none; border-top: 2px solid #000; margin-top: 4px; padding-top: 10px !important; }
    .t-total .lbl, .t-total .val { font-size: 15px; font-weight: 700; color: #000; }
    .note-box { margin-top: 20px; padding: 11px 13px; background: #f7f7f7; border-radius: 4px; }
    .note-lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 5px; }
    .note-text { font-size: 13px; color: #333; }
    .receipt-footer {
      margin-top: 28px; padding-top: 14px;
      border-top: 1px solid #eee;
      font-size: 11px; color: #aaa; text-align: center; line-height: 1.9;
    }
    @media (max-width: 480px) {
      .receipt { padding: 20px 16px; }
      .receipt-header { flex-direction: column; gap: 6px; }
      .receipt-date { text-align: left; }
      .info-grid { grid-template-columns: 1fr; }
      .info-right { text-align: left; }
      .totals { max-width: 100%; }
      thead th, tbody td { padding: 7px 5px; }
      tbody td { font-size: 13px; }
    }
    @media print {
      .receipt { padding: 0; max-width: 100%; }
      .receipt-footer { margin-top: 16px; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      <div>
        <div class="receipt-title">REÇU</div>
        <div class="receipt-num">Commande n° ${escapeHtml(invoiceNumber)}</div>
      </div>
      <div class="receipt-date">
        <div><strong>${dateStr}</strong></div>
        <div>${timeStr}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-block">
        <div class="lbl">Restaurant</div>
        <p>
          <strong>A Beyrouth</strong><br>
          PAPA (SARL)<br>
          4 Esplanade du Général de Gaulle<br>
          92400 Courbevoie<br>
          <span style="font-size:12px;color:#999;">SIRET : 830 675 047 RCS Nanterre<br>TVA : FR93 830 675 047</span>
        </p>
      </div>
      <div class="info-block info-right">
        <div class="lbl">Client</div>
        <p>
          ${order.invoice_company ? `<strong>${escapeHtml(order.invoice_company)}</strong><br>` : ''}
          <strong>${escapeHtml(order.client_prenom)}</strong><br>
          ${escapeHtml(order.client_email)}<br>
          ${order.client_telephone ? escapeHtml(order.client_telephone) : ''}
          ${order.invoice_siret ? `<br><span style="font-size:12px;color:#999;">SIRET : ${escapeHtml(order.invoice_siret)}</span>` : ''}
          ${order.invoice_address ? `<br>${escapeHtml(order.invoice_address)}` : ''}
        </p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Désignation</th>
          <th class="c">Qté</th>
          <th class="r">P.U. TTC</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="t-line"><span class="lbl">Sous-total HT</span><span class="val">${totalHT.toFixed(2)} €</span></div>
      <div class="t-line"><span class="lbl">TVA restauration (10%)</span><span class="val">${tva.toFixed(2)} €</span></div>
      <div class="t-line t-total"><span class="lbl">Total payé</span><span class="val">${totalTTC.toFixed(2)} €</span></div>
    </div>

    ${order.note ? `
    <div class="note-box">
      <div class="note-lbl">Note</div>
      <div class="note-text">${escapeHtml(order.note)}</div>
    </div>
    ` : ''}

    <div class="receipt-footer">
      <strong>A Beyrouth</strong> — Restaurant libanais<br>
      4 Esplanade du Général de Gaulle, 92400 Courbevoie — Métro La Défense (L1, A, T2)<br>
      SIRET : 830 675 047 RCS Nanterre — TVA : FR93 830 675 047<br>
      Commande via beyrouth.express
    </div>
  </div>
</body>
</html>
  `
}
