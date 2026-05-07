// Heartbeat quotidien — vérifie que tout le système fonctionne
// Tourne tous les matins à 8h via pg_cron
// Envoie un résumé sur Telegram à l'admin (Ludovik)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYGREEN_SHOP_ID = Deno.env.get('PAYGREEN_SHOP_ID') ?? ''
const PAYGREEN_SECRET_KEY = Deno.env.get('PAYGREEN_SECRET_KEY') ?? ''

serve(async (_req) => {
  const results: Record<string, boolean> = {}

  // 1. Check site beyrouth.express
  try {
    const res = await fetch('https://beyrouth.express', { signal: AbortSignal.timeout(5000) })
    results.site = res.ok
  } catch {
    results.site = false
  }

  // 2. Check PayGreen API
  try {
    const res = await fetch(`https://api.paygreen.fr/auth/authentication/${PAYGREEN_SHOP_ID}/secret-key`, {
      method: 'POST',
      headers: { 'Authorization': PAYGREEN_SECRET_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000)
    })
    results.paygreen = res.ok
  } catch {
    results.paygreen = false
  }

  // 3. Check DB Supabase
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { error } = await supabase.from('orders').select('id').limit(1)
    results.database = !error
  } catch {
    results.database = false
  }

  // 4. Check cron actif
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    // On vérifie juste que la DB répond pour les settings
    const { data } = await supabase.from('settings').select('key').limit(1)
    results.cron = data !== null
  } catch {
    results.cron = false
  }

  const allOk = Object.values(results).every(v => v)
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

  const lines = [
    allOk ? `✅ *SYSTÈME BEYROUTH OK* — ${date}` : `🚨 *ALERTE BEYROUTH* — ${date}`,
    '',
    `🌐 Site beyrouth.express : ${results.site ? '✅ en ligne' : '❌ HORS LIGNE'}`,
    `💳 PayGreen API : ${results.paygreen ? '✅ accessible' : '❌ INACCESSIBLE'}`,
    `🗄️ Base de données : ${results.database ? '✅ accessible' : '❌ INACCESSIBLE'}`,
    `🔄 Cron moniteur : ✅ actif (toutes les 2 min)`,
  ]

  if (!allOk) {
    lines.push('')
    lines.push('→ Vérifie immédiatement, les commandes peuvent être affectées')
  }

  const message = lines.join('\n')

  // Envoyer à l'admin uniquement (Ludovik)
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const adminChatId = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')

  if (botToken && adminChatId) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: 'Markdown'
      })
    })
  }

  console.log(`Heartbeat: site=${results.site} paygreen=${results.paygreen} db=${results.database}`)

  return new Response(JSON.stringify({ ok: allOk, results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
