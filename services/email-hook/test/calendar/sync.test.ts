import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncUser } from '../../src/calendar/sync'

vi.mock('../../src/calendar/busy-days', () => ({ deriveAvailableDays: () => ['2030-07-01'] }))

const env = { SUPABASE_URL: 'https://db', SUPABASE_SERVICE_ROLE_KEY: 'srk' } as never
const feeds = [
  { id: 'f1', url: 'https://a/cal.ics', etag: null, last_modified: null, last_synced_at: null },
  { id: 'f2', url: 'https://b/cal.ics', etag: null, last_modified: null, last_synced_at: null },
]
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:x\r\nEND:VCALENDAR'

function stubFetch(feedB: () => Response) {
  const calls: { url: string, init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('user_calendar_feeds?user_id'))
      return Response.json(feeds)
    if (url.includes('user_calendar_settings'))
      return Response.json([])
    if (url === 'https://a/cal.ics')
      return new Response(ICS)
    if (url === 'https://b/cal.ics')
      return feedB()
    return new Response(null, { status: 204 })
  }))
  return calls
}

const rpcCalled = (calls: { url: string }[]) => calls.some(c => c.url.includes('rpc/apply_calendar_availability'))
function patches(calls: { url: string, init?: RequestInit }[]) {
  return calls.filter(c => c.init?.method === 'PATCH').map(c => [c.url.split('eq.')[1], JSON.parse(String(c.init!.body))])
}

describe('syncUser', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('should write nothing when one of two feeds fails', async () => {
    const calls = stubFetch(() => new Response('gone', { status: 403 }))
    expect(await syncUser(env, 'u1')).toBe('failed')
    expect(rpcCalled(calls)).toBe(false)
    expect(patches(calls)).toEqual([['f2', { last_error: 'http_403' }]])
  })

  it('should fail closed on a 200 that is not iCalendar', async () => {
    const calls = stubFetch(() => new Response('<html>sign in</html>'))
    expect(await syncUser(env, 'u1')).toBe('failed')
    expect(rpcCalled(calls)).toBe(false)
  })

  it('should fail with too_large when Content-Length exceeds 2 MB', async () => {
    const calls = stubFetch(() => new Response(ICS, { headers: { 'content-length': String(3 * 1024 * 1024) } }))
    expect(await syncUser(env, 'u1')).toBe('failed')
    expect(patches(calls)).toEqual([['f2', { last_error: 'too_large' }]])
  })

  it('should fail with too_large when an unannounced stream passes 2 MB', async () => {
    const calls = stubFetch(() => new Response(new Blob(['x'.repeat(2 * 1024 * 1024 + 1)]).stream()))
    expect(await syncUser(env, 'u1')).toBe('failed')
    expect(patches(calls)).toEqual([['f2', { last_error: 'too_large' }]])
  })
})
