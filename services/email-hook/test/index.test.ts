import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../src/index'

const VALID_ENV = {
  BREVO_API_KEY: 'key-abc',
  SEND_EMAIL_HOOK_SECRET: 'whsec_dGVzdHNlY3JldA==',
  BREVO_TEMPLATE_EN: '10',
  BREVO_TEMPLATE_DE: '20',
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  VAPID_PUBLIC_KEY: 'vapid-pub',
  VAPID_PRIVATE_KEY: 'vapid-priv',
  VAPID_SUBJECT: 'mailto:no-reply@example.com',
  BREVO_TEMPLATE_FRIEND_RECEIVED_EN: '30',
  BREVO_TEMPLATE_FRIEND_RECEIVED_DE: '31',
  BREVO_TEMPLATE_FRIEND_RESPONDED_EN: '32',
  BREVO_TEMPLATE_FRIEND_RESPONDED_DE: '33',
}

const VALID_PAYLOAD = {
  user: {
    email: 'user@example.com',
    user_metadata: { locale: 'en' },
  },
  email_data: {
    token: '123456',
  },
}

vi.mock('standardwebhooks', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn(),
  })),
}))

function makeRequest(body: unknown, headers: Record<string, string> = {}, path = '/') {
  return new Request(`https://worker.example.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': 'test-id',
      'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
      'webhook-signature': 'v1,validsig',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function makeNotifyRequest(path: string, body: unknown, jwt = 'valid-jwt') {
  return new Request(`https://worker.example.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  })
}

describe('email-hook worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
  })

  it('returns 200 and calls Brevo on valid EN payload', async () => {
    const response = await worker.fetch(makeRequest(VALID_PAYLOAD), VALID_ENV as never)
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({ method: 'POST' }),
    )
    const brevoBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    )
    expect(brevoBody.templateId).toBe(10)
  })

  it('sends DE template for de locale', async () => {
    const payload = {
      ...VALID_PAYLOAD,
      user: { ...VALID_PAYLOAD.user, user_metadata: { locale: 'de' } },
    }
    await worker.fetch(makeRequest(payload), VALID_ENV as never)
    const brevoBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    )
    expect(brevoBody.templateId).toBe(20)
  })

  it('sends EN template for unknown locale', async () => {
    const payload = {
      ...VALID_PAYLOAD,
      user: { ...VALID_PAYLOAD.user, user_metadata: { locale: 'fr' } },
    }
    await worker.fetch(makeRequest(payload), VALID_ENV as never)
    const brevoBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    )
    expect(brevoBody.templateId).toBe(10)
  })

  it('forwards OTP token verbatim as params.otp', async () => {
    await worker.fetch(makeRequest(VALID_PAYLOAD), VALID_ENV as never)
    const brevoBody = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string,
    )
    expect(brevoBody.params.otp).toBe('123456')
    expect(brevoBody.params.email).toBe('user@example.com')
  })

  it('returns 400 when email_data.token is missing', async () => {
    const payload = { ...VALID_PAYLOAD, email_data: {} }
    const response = await worker.fetch(makeRequest(payload), VALID_ENV as never)
    expect(response.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns 401 when signature verification fails', async () => {
    const { Webhook } = await import('standardwebhooks')
    vi.mocked(Webhook).mockImplementationOnce(() => ({
      verify: vi.fn().mockImplementation(() => {
        throw new Error('invalid sig')
      }),
    }))
    const response = await worker.fetch(makeRequest(VALID_PAYLOAD), VALID_ENV as never)
    expect(response.status).toBe(401)
  })

  it('returns 500 when env config is missing', async () => {
    const env = { ...VALID_ENV, BREVO_API_KEY: '' }
    const response = await worker.fetch(makeRequest(VALID_PAYLOAD), env as never)
    expect(response.status).toBe(500)
  })

  it('returns 502 when Brevo returns an error', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('Internal Server Error', { status: 500 }))
    const response = await worker.fetch(makeRequest(VALID_PAYLOAD), VALID_ENV as never)
    expect(response.status).toBe(502)
  })

  it('returns JSON content-type on success', async () => {
    const response = await worker.fetch(makeRequest(VALID_PAYLOAD), VALID_ENV as never)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(await response.text()).toBe('{}')
  })

  it('returns 405 for non-POST methods', async () => {
    const req = new Request('https://worker.example.com/', { method: 'GET' })
    const response = await worker.fetch(req, VALID_ENV as never)
    expect(response.status).toBe(405)
  })
})

describe('notify routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when Authorization header is missing for received route', async () => {
    const req = new Request('https://worker.example.com/notify/friend-request-received', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId: 'abc' }),
    })
    // JWT verifier calls /auth/v1/user — mock to return 401
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 401 }))
    const response = await worker.fetch(req, VALID_ENV as never)
    expect(response.status).toBe(401)
  })

  it('returns 403 when caller is not the sender for received route', async () => {
    globalThis.fetch = vi.fn()
      // First call: JWT verify → returns user id = 'user-b'
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-b' }), { status: 200 }))
      // Second call: fetch friendship → from_user_id = 'user-a' (not caller)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'f1', from_user_id: 'user-a', to_user_id: 'user-b' }]),
          { status: 200 },
        ),
      )

    const req = makeNotifyRequest('/notify/friend-request-received', { friendshipId: 'f1' })
    const response = await worker.fetch(req, VALID_ENV as never)
    expect(response.status).toBe(403)
  })

  it('returns 403 when caller is not the responder for responded route', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-a' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'f1', from_user_id: 'user-a', to_user_id: 'user-b' }]),
          { status: 200 },
        ),
      )

    const req = makeNotifyRequest('/notify/friend-request-responded', { friendshipId: 'f1' })
    const response = await worker.fetch(req, VALID_ENV as never)
    expect(response.status).toBe(403)
  })

  it('does not dispatch when recipient has muted friend_requests', async () => {
    globalThis.fetch = vi.fn()
      // JWT verify → caller is sender
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-a' }), { status: 200 }))
      // Fetch friendship
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'f1', from_user_id: 'user-a', to_user_id: 'user-b' }]),
          { status: 200 },
        ),
      )
      // Fetch recipient profile — muted friend_requests
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'user-b', notif_push_enabled: true, notif_email_enabled: true, notif_muted_types: ['friend_requests'], locale: 'en' }]),
          { status: 200 },
        ),
      )
      // Fetch actor display name
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ first_name: 'Alice', last_name: 'Smith' }]), { status: 200 }),
      )
      // Fetch recipient email
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-b', email: 'b@example.com' }), { status: 200 }),
      )

    const req = makeNotifyRequest('/notify/friend-request-received', { friendshipId: 'f1' })
    const response = await worker.fetch(req, VALID_ENV as never)
    expect(response.status).toBe(200)
    // No Brevo or push call should occur (all calls are data fetches above)
    const brevoCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]: [string]) => url === 'https://api.brevo.com/v3/smtp/email',
    )
    expect(brevoCall).toBeUndefined()
  })

  it('falls back to EN template when locale is unknown', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-a' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'f1', from_user_id: 'user-a', to_user_id: 'user-b' }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'user-b', notif_push_enabled: false, notif_email_enabled: true, notif_muted_types: [], locale: 'fr' }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ first_name: 'Alice', last_name: null }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-b', email: 'b@example.com' }), { status: 200 }),
      )
      // Brevo call
      .mockResolvedValueOnce(new Response('OK', { status: 200 }))

    const req = makeNotifyRequest('/notify/friend-request-received', { friendshipId: 'f1' })
    await worker.fetch(req, VALID_ENV as never)

    const brevoCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]: [string]) => url === 'https://api.brevo.com/v3/smtp/email',
    )
    expect(brevoCall).toBeDefined()
    const body = JSON.parse(brevoCall[1].body as string)
    expect(body.templateId).toBe(30) // EN received template
  })

  it('tour-changed deleted: excludes a partner who is not the caller\'s friend', async () => {
    // Authz boundary: partnerContactIds resolve to two users, but only one is a
    // friend of the caller. The non-friend must be filtered out (recipients ∩ friends).
    globalThis.fetch = vi.fn()
      // JWT verify → caller is the owner
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'owner' }), { status: 200 }))
      // resolveUsersByContactIds RPC → two partner users
      .mockResolvedValueOnce(
        new Response(JSON.stringify(['user-friend', 'user-stranger']), { status: 200 }),
      )
      // fetchFriendUserIds → owner is only friends with user-friend
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ request_user_id: 'owner', response_user_id: 'user-friend' }]),
          { status: 200 },
        ),
      )
      // dispatch to user-friend: profile (push+email off → no outbound sends)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'user-friend', notif_push_enabled: false, notif_email_enabled: false, notif_muted_types: [], locale: 'en' }]),
          { status: 200 },
        ),
      )
      // actor display name
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ first_name: 'Owner', last_name: null }]), { status: 200 }),
      )
      // recipient email
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-friend', email: 'f@example.com' }), { status: 200 }),
      )

    const req = makeNotifyRequest('/notify/tour-changed', {
      action: 'deleted',
      partnerContactIds: ['c1', 'c2'],
      tourName: 'Gfroren Hora',
    })
    const response = await worker.fetch(req, VALID_ENV as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ notified: 1 })
    // The stranger must never have been resolved to a profile fetch (filtered pre-dispatch).
    const touchedStranger = (fetch as ReturnType<typeof vi.fn>).mock.calls.some(
      ([url]: [string]) => url.includes('user-stranger'),
    )
    expect(touchedStranger).toBe(false)
  })

  it('tour-changed deleted: no partner contact ids → skipped, nothing dispatched', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'owner' }), { status: 200 }))

    const req = makeNotifyRequest('/notify/tour-changed', {
      action: 'deleted',
      partnerContactIds: [],
      tourName: 'Solo Tour',
    })
    const response = await worker.fetch(req, VALID_ENV as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ skipped: 'no_partners' })
    // Only the JWT verify fetch occurred — no resolution, no dispatch.
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('responded route body does not expose accept/decline outcome', async () => {
    // The responded route sends a generic "responded to your request" message
    // Verify no accept/decline wording is sent to push or email
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-b' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'f1', from_user_id: 'user-a', to_user_id: 'user-b' }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 'user-a', notif_push_enabled: false, notif_email_enabled: true, notif_muted_types: [], locale: 'en' }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ first_name: 'Bob', last_name: null }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'user-a', email: 'a@example.com' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response('OK', { status: 200 }))

    const req = makeNotifyRequest('/notify/friend-request-responded', { friendshipId: 'f1' })
    await worker.fetch(req, VALID_ENV as never)

    const brevoCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]: [string]) => url === 'https://api.brevo.com/v3/smtp/email',
    )
    const body = JSON.parse(brevoCall[1].body as string)
    // Should use responded template, not received
    expect(body.templateId).toBe(32) // EN responded template
    // No accept/decline in the params (outcome is not passed to template)
    const bodyStr = JSON.stringify(body).toLowerCase()
    expect(bodyStr).not.toContain('accept')
    expect(bodyStr).not.toContain('decline')
  })
})
