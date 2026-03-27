// Utilitaire pour envoyer des emails via Brevo API
interface EmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
  orderId?: number  // Pour sync auto du statut
}

export async function sendEmailViaBrevo(options: EmailOptions): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')

    if (!brevoApiKey) {
      console.error('❌ Brevo API key not configured')
      throw new Error('Brevo API key not configured')
    }

    console.log(`📧 Envoi email via Brevo à ${options.to}`)

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify({
        sender: {
          name: 'A Beyrouth',
          email: 'commande@beyrouth.express'
        },
        to: [
          {
            email: options.to
          }
        ],
        subject: options.subject,
        htmlContent: options.html,
        replyTo: options.replyTo ? {
          email: options.replyTo
        } : undefined
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Erreur Brevo API:', errorData)
      throw new Error(`Brevo API error: ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    console.log('✅ Email envoyé via Brevo, messageId:', result.messageId)

    // Sync statut email automatiquement (async, ne bloque pas)
    if (options.orderId && result.messageId) {
      syncEmailStatusAsync(options.orderId, result.messageId)
    }

    return { success: true, id: result.messageId }
  } catch (error) {
    console.error('❌ Erreur Brevo:', error.message)
    return { success: false, error: error.message }
  }
}

// Fonction async pour sync le statut email (ne bloque pas l'envoi)
function syncEmailStatusAsync(orderId: number, messageId: string) {
  setTimeout(async () => {
    try {
      console.log(`🔄 Sync statut email pour commande ${orderId}...`)

      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-email-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderId, messageId })
        }
      )

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Statut email synced: ${data.status}`)
      } else {
        console.error('❌ Erreur sync statut:', await response.text())
      }
    } catch (error) {
      console.error('❌ Erreur sync async:', error.message)
    }
  }, 10000) // Attendre 10s pour que Brevo indexe l'email
}
