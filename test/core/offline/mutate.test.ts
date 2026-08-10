import { afterEach, describe, expect, it, vi } from 'vitest'
import { mutate, offlineBlockedAt } from '@/core/offline/mutate'
import { isOnline } from '@/core/offline/use-online-status'

describe('mutate offline seam', () => {
  afterEach(() => {
    isOnline.value = true
  })

  it('offline: does not run fn, returns undefined, and bumps the blocked signal', async () => {
    isOnline.value = false
    const fn = vi.fn().mockResolvedValue('done')
    const before = offlineBlockedAt.value

    const result = await mutate(fn)

    expect(fn).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
    expect(offlineBlockedAt.value).toBeGreaterThan(before)
  })

  it('online: runs fn and returns its value without touching the blocked signal', async () => {
    isOnline.value = true
    const before = offlineBlockedAt.value

    const result = await mutate(() => Promise.resolve('done'))

    expect(result).toBe('done')
    expect(offlineBlockedAt.value).toBe(before)
  })
})
