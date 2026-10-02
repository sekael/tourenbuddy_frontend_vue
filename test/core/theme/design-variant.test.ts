import { afterEach, describe, expect, it, vi } from 'vitest'
import { designVariant, readDesignVariant, setDesignVariant } from '@/core/theme/design-variant'

describe('design variant', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('should fall back to classic when the stored value is not a known variant', () => {
    localStorage.setItem('tb.design', 'neon')
    expect(readDesignVariant()).toBe('classic')
  })

  it('should fall back to classic when storage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readDesignVariant()).toBe('classic')
  })

  it('should still apply the variant for the session when storage throws on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => setDesignVariant('alpenglow')).not.toThrow()
    expect(document.documentElement.dataset.design).toBe('alpenglow')
    expect(designVariant.value).toBe('alpenglow')
  })
})
