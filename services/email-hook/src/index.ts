import { Webhook } from 'standardwebhooks'

interface Env {
  SUPABASE_URL: string
  BREVO_API_KEY: string
  SEND_EMAIL_HOOK_SECRET: string
  BREVO_TEMPLATE_EN: string
  BREVO_TEMPLATE_DE: string
}

interface SupabaseHookPayload {
  user: {
    email: string
    user_metadata?: {
      locale?: string
    }
  }
  email_data: {
    token_hash: string
    email_action_type: string
    redirect_to: string
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    if (
      !env.BREVO_API_KEY ||
      !env.SEND_EMAIL_HOOK_SECRET ||
      !env.BREVO_TEMPLATE_EN ||
      !env.BREVO_TEMPLATE_DE
    ) {
      return new Response('Missing required configuration', { status: 500 })
    }

    const webhookId = request.headers.get('webhook-id') ?? ''
    const webhookTimestamp = request.headers.get('webhook-timestamp') ?? ''
    const webhookSignature = request.headers.get('webhook-signature') ?? ''
    const body = await request.text()

    const wh = new Webhook(env.SEND_EMAIL_HOOK_SECRET)
    try {
      wh.verify(body, {
        'webhook-id': webhookId,
        'webhook-timestamp': webhookTimestamp,
        'webhook-signature': webhookSignature,
      })
    } catch {
      return new Response('Invalid signature', { status: 401 })
    }

    let payload: SupabaseHookPayload
    try {
      payload = JSON.parse(body) as SupabaseHookPayload
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const { user, email_data } = payload
    const locale = user.user_metadata?.locale
    const templateId = Number(locale === 'de' ? env.BREVO_TEMPLATE_DE : env.BREVO_TEMPLATE_EN)

    const magicLink = `${env.SUPABASE_URL}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [{ email: user.email }],
        templateId,
        params: {
          magic_link: magicLink,
          email: user.email,
        },
      }),
    })

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text()
      console.error(`Brevo error ${brevoResponse.status}: ${errorText}`)
      return new Response('Email delivery failed', { status: 502 })
    }

    return new Response('OK', { status: 200 })
  },
}
