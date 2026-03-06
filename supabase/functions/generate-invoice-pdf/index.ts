// Edge Function: Générer facture PDF
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

    // Récupérer la commande
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

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
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  // Utiliser le numéro de facture si disponible, sinon numéro de commande
  const invoiceNumber = order.invoice_number || order.numero

  // Calculer TVA (10% restauration)
  const totalTTC = order.total
  const totalHT = totalTTC / 1.10
  const tva = totalTTC - totalHT

  // Items HTML
  const itemsHtml = order.items.map((item: any) => {
    let html = `
      <tr>
        <td style="padding:8px 0; border-bottom:1px solid #eee;">${item.nom}</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:center;">${item.quantite}</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">${item.prix.toFixed(2)}€</td>
        <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">${(item.prix * item.quantite).toFixed(2)}€</td>
      </tr>
    `

    // Suppléments
    if (item.supplements && item.supplements.length > 0) {
      item.supplements.forEach((supp: any) => {
        html += `
          <tr>
            <td style="padding:4px 0 4px 20px; border-bottom:1px solid #eee; font-size:13px; color:#666;">+ ${supp.nom}</td>
            <td style="padding:4px 0; border-bottom:1px solid #eee;"></td>
            <td style="padding:4px 0; border-bottom:1px solid #eee; text-align:right; font-size:13px;">${supp.prix.toFixed(2)}€</td>
            <td style="padding:4px 0; border-bottom:1px solid #eee; text-align:right; font-size:13px;">${supp.prix.toFixed(2)}€</td>
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
  <title>Facture ${order.numero}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 40px;
      color: #333;
    }
    .invoice-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #667eea;
    }
    .invoice-title {
      font-size: 32px;
      font-weight: 700;
      color: #667eea;
    }
    .invoice-number {
      font-size: 18px;
      color: #666;
      margin-top: 10px;
    }
    .restaurant-info, .client-info {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .info-line {
      font-size: 15px;
      line-height: 1.8;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    th {
      text-align: left;
      padding: 12px 0;
      border-bottom: 2px solid #333;
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      color: #666;
    }
    th.center { text-align: center; }
    th.right { text-align: right; }
    td {
      font-size: 15px;
    }
    .totals {
      margin-top: 30px;
      text-align: right;
    }
    .totals-line {
      display: flex;
      justify-content: flex-end;
      padding: 8px 0;
      font-size: 15px;
    }
    .totals-label {
      width: 150px;
      text-align: right;
      padding-right: 20px;
      color: #666;
    }
    .totals-value {
      width: 100px;
      text-align: right;
      font-weight: 600;
    }
    .total-ttc {
      border-top: 2px solid #333;
      padding-top: 12px;
      margin-top: 12px;
      font-size: 18px;
      font-weight: 700;
      color: #667eea;
    }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #888;
      text-align: center;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
    .print-btn:hover {
      background: #5568d3;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer / Télécharger PDF</button>

  <div class="invoice-header">
    <div>
      <div class="invoice-title">FACTURE</div>
      <div class="invoice-number">N° ${invoiceNumber}</div>
    </div>
    <div style="text-align: right;">
      <div class="info-line"><strong>Date :</strong> ${dateStr}</div>
      <div class="info-line"><strong>Heure :</strong> ${timeStr}</div>
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
    <div class="restaurant-info">
      <div class="section-title">Restaurant</div>
      <div class="info-line"><strong>Beyrouth Express</strong></div>
      <div class="info-line">PAPA (SARL)</div>
      <div class="info-line">4 Esplanade du Général de Gaulle</div>
      <div class="info-line">92400 Courbevoie</div>
      <div class="info-line" style="margin-top:10px;">SIRET : 830 675 047 RCS Nanterre</div>
      <div class="info-line">TVA : FR93 830 675 047</div>
    </div>

    <div class="client-info" style="text-align: right;">
      <div class="section-title">Client</div>
      ${order.invoice_company ? `<div class="info-line"><strong>${order.invoice_company}</strong></div>` : ''}
      <div class="info-line"><strong>${order.client_prenom}</strong></div>
      <div class="info-line">${order.client_email}</div>
      ${order.client_telephone ? `<div class="info-line">${order.client_telephone}</div>` : ''}
      ${order.invoice_siret ? `<div class="info-line" style="margin-top:10px;">SIRET : ${order.invoice_siret}</div>` : ''}
      ${order.invoice_address ? `<div class="info-line">${order.invoice_address}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th class="center">Qté</th>
        <th class="right">P.U. TTC</th>
        <th class="right">Total TTC</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-line">
      <div class="totals-label">Total HT :</div>
      <div class="totals-value">${totalHT.toFixed(2)}€</div>
    </div>
    <div class="totals-line">
      <div class="totals-label">TVA 10% :</div>
      <div class="totals-value">${tva.toFixed(2)}€</div>
    </div>
    <div class="totals-line total-ttc">
      <div class="totals-label">Total TTC :</div>
      <div class="totals-value">${totalTTC.toFixed(2)}€</div>
    </div>
  </div>

  ${order.note ? `
  <div style="margin-top:40px; padding:15px; background:#f8f9ff; border-left:4px solid #667eea; border-radius:4px;">
    <div style="font-size:14px; font-weight:600; color:#667eea; margin-bottom:5px;">Note :</div>
    <div style="font-size:14px; color:#666;">${order.note}</div>
  </div>
  ` : ''}

  <div class="footer">
    <p style="margin:5px 0;"><strong>Beyrouth Express</strong> - Restaurant libanais</p>
    <p style="margin:5px 0;">PAPA (SARL) - Capital social : 350 000€</p>
    <p style="margin:5px 0;">4 Esplanade du Général de Gaulle, 92400 Courbevoie</p>
    <p style="margin:5px 0;">SIRET : 830 675 047 RCS Nanterre - TVA : FR93 830 675 047</p>
    <p style="margin:5px 0;">Métro : La Défense (lignes 1, A, T2)</p>
  </div>
</body>
</html>
  `
}
