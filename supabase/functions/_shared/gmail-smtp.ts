// Utilitaire pour envoyer des emails via Gmail SMTP
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

interface EmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmailViaGmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const gmailUser = Deno.env.get('GMAIL_USER')
    const gmailPassword = Deno.env.get('GMAIL_PASSWORD')

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured')
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    })

    await client.send({
      from: `A Beyrouth <${gmailUser}>`,
      to: options.to,
      subject: options.subject,
      mimeContent: [
        {
          contentType: "text/html; charset=utf-8",
          content: options.html,
        },
      ],
      ...(options.replyTo && { replyTo: options.replyTo }),
    })

    await client.close()

    return { success: true }
  } catch (error) {
    console.error('Gmail SMTP error:', error)
    return { success: false, error: error.message }
  }
}
