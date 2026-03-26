// Utilitaire pour envoyer des emails via Brevo API
interface EmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
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

    return { success: true, id: result.messageId }
  } catch (error) {
    console.error('❌ Erreur Brevo:', error.message)
    return { success: false, error: error.message }
  }
}
