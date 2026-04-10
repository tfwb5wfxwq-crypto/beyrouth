// Edge Function: Envoyer notification Telegram pour nouvelle commande
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://beyrouth.express',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderNumber, pickupTime, total, paymentMethod, items, note } = await req.json()

    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('❌ Config Telegram manquante')
      return new Response(
        JSON.stringify({ error: 'Config Telegram manquante' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Formater les items (avec détails formule si applicable)
    const itemsList = items && items.length > 0
      ? items.map((item: any) => {
          const qty = item.quantite || item.qty || 1
          let line = `• ${qty}x ${item.nom}`
          if (item.isFormule && item.components && item.components.length > 0) {
            line += `\n  ↳ ${item.components.join(' · ')}`
          }
          return line
        }).join('\n')
      : 'Aucun détail'

    // Note client (si présente)
    const noteSection = note ? `\n\n⚠️ *Note client* : ${note}` : ''

    // Message Telegram avec emoji et formatage
    const message = `
🆕 *NOUVELLE COMMANDE*

📦 *Commande* : \`${orderNumber}\`
⏰ *Retrait* : ${pickupTime || 'Dès que possible'}
💰 *Total* : *${total}€*
💳 *Paiement* : ${paymentMethod === 'edenred' ? '🎫 Edenred' : '💳 PayGreen'}

*Articles :*
${itemsList}${noteSection}
    `.trim()

    // Envoyer via Telegram Bot API
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      }
    )

    const telegramData = await telegramResponse.json()

    if (!telegramData.ok) {
      console.error('❌ Erreur Telegram API:', telegramData)
      throw new Error(telegramData.description || 'Erreur Telegram')
    }

    console.log(`✅ Notification Telegram envoyée pour commande ${orderNumber}`)

    return new Response(
      JSON.stringify({ success: true, messageId: telegramData.result.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Erreur send-telegram-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
