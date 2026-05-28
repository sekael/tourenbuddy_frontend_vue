import type { Env } from './config'
import { Webhook } from 'standardwebhooks'
import { corsHeaders, jsonResponse, resolveLocale } from './config'
import {
  handleFriendRequestReceived,
  handleFriendRequestResponded,
  handleGroupMembershipEvent,
  handleLinkRequestEvent,
  handleTourChanged,
  handleTourInterest,
} from './notify'

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

async function handleEmailHook(request: Request, env: Env): Promise<Response> {
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
}

function withCors(response: Response, request: Request): Response {
  const headers = corsHeaders(request)
  if (Object.keys(headers).length === 0)
    return response
  const merged = new Headers(response.headers)
  for (const [k, v] of Object.entries(headers)) merged.set(k, v)
  return new Response(response.body, { status: response.status, headers: merged })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method !== 'POST') {
      return withCors(jsonResponse(405, { error: 'method_not_allowed' }), request)
    }

    const url = new URL(request.url)

    try {
      if (url.pathname === '/notify/friend-request-received') {
        return withCors(await handleFriendRequestReceived(request, env), request)
      }

      if (url.pathname === '/notify/friend-request-responded') {
        return withCors(await handleFriendRequestResponded(request, env), request)
      }

      if (url.pathname === '/notify/tour-changed') {
        return withCors(await handleTourChanged(request, env), request)
      }

      if (url.pathname === '/notify/tour-interest') {
        return withCors(await handleTourInterest(request, env), request)
      }

      if (url.pathname === '/notify/link-request-event') {
        return withCors(await handleLinkRequestEvent(request, env), request)
      }

      if (url.pathname === '/notify/group-membership-event') {
        return withCors(await handleGroupMembershipEvent(request, env), request)
      }

      // Default: Supabase Auth email hook (verifies signature internally, no CORS — server-to-server)
      return await handleEmailHook(request, env)
    }
    catch (err) {
      console.error(`[worker] uncaught error on ${url.pathname}:`, err)
      return withCors(
        jsonResponse(500, { error: 'internal_error', message: (err as Error).message }),
        request,
      )
    }
  },
}
