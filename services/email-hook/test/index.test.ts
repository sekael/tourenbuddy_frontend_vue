import { beforeEach, describe, expect, it, vi } from 'vitest'
import worker from '../src/index'

const VALID_ENV = {
  BREVO_API_KEY: 'key-abc',
  SEND_EMAIL_HOOK_SECRET: 'whsec_dGVzdHNlY3JldA==',
  BREVO_TEMPLATE_EN: '10',
  BREVO_TEMPLATE_DE: '20',
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

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://worker.example.com/', {
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
