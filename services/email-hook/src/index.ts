import { Webhook } from 'standardwebhooks'

interface Env {
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
    token: string
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

function jsonResponse(status: number, body: Record<string, unknown> = {}) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function resolveLocale(metadataLocale: string | undefined): 'en' | 'de' {
  return metadataLocale === 'de' ? 'de' : 'en'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'method_not_allowed' })
    }

    if (
      !env.BREVO_API_KEY
      || !env.SEND_EMAIL_HOOK_SECRET
      || !env.BREVO_TEMPLATE_EN
      || !env.BREVO_TEMPLATE_DE
    ) {
      return jsonResponse(500, { error: 'missing_configuration' })
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
    }
    catch {
      return jsonResponse(401, { error: 'invalid_signature' })
    }

    let payload: SupabaseHookPayload
    try {
      payload = JSON.parse(body) as SupabaseHookPayload
    }
    catch {
      return jsonResponse(400, { error: 'invalid_json' })
    }

    const { user, email_data } = payload

    if (!email_data.token) {
      return jsonResponse(400, { error: 'missing_otp_token' })
    }

    const locale = resolveLocale(user.user_metadata?.locale)
    const templateId = Number(locale === 'de' ? env.BREVO_TEMPLATE_DE : env.BREVO_TEMPLATE_EN)

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
          otp: email_data.token,
          email: user.email,
        },
      }),
    })

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text()
      console.error(`Brevo error ${brevoResponse.status}: ${errorText}`)
      return jsonResponse(502, { error: 'email_delivery_failed' })
    }

    return jsonResponse(200)
  },
}
