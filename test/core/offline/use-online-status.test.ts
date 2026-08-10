import { afterEach, describe, expect, it } from 'vitest'
import { isOnline } from '@/core/offline/use-online-status'

describe('useOnlineStatus singleton', () => {
  afterEach(() => {
    isOnline.value = true
  })

  it('flips to false on a window offline event and back to true on online', () => {
    window.dispatchEvent(new Event('offline'))
    expect(isOnline.value).toBe(false)

    window.dispatchEvent(new Event('online'))
    expect(isOnline.value).toBe(true)
  })
})
