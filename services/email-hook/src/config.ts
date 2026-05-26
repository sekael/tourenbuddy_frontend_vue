export interface Env {
  // Existing OTP email secrets
  BREVO_API_KEY: string
  SEND_EMAIL_HOOK_SECRET: string
  BREVO_TEMPLATE_EN: string
  BREVO_TEMPLATE_DE: string

  // Notification secrets
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  BREVO_TEMPLATE_FRIEND_RECEIVED_EN: string
  BREVO_TEMPLATE_FRIEND_RECEIVED_DE: string
  BREVO_TEMPLATE_FRIEND_RESPONDED_EN: string
  BREVO_TEMPLATE_FRIEND_RESPONDED_DE: string
  // Shared-tour notifications: one generic template per type per locale.
  BREVO_TEMPLATE_TOUR_UPDATES_EN: string
  BREVO_TEMPLATE_TOUR_UPDATES_DE: string
  BREVO_TEMPLATE_TOUR_INTEREST_EN: string
  BREVO_TEMPLATE_TOUR_INTEREST_DE: string

  // Optional: app URL used for push deep-links and email links.
  // Defaults to https://test.tourenbuddy.ch if unset.
  // Override to https://tourenbuddy.ch (or www variant) when prod domain goes live.
  APP_URL?: string
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://test.tourenbuddy.ch',
  'https://tourenbuddy.ch',
  'https://www.tourenbuddy.ch',
])

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : origin.endsWith('.touringbuddy.pages.dev')
      ? origin
      : ''
  if (!allowOrigin)
    return {}
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

export function jsonResponse(
  status: number,
  body: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  })
}

export function resolveLocale(locale: string | null | undefined): 'en' | 'de' {
  return locale === 'de' || locale === 'de-CH' ? 'de' : 'en'
}
