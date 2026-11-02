import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

async function freshPace() {
  vi.resetModules()
  return (await import('@/core/composables/use-pace')).pace
}

describe('pace', () => {
  beforeEach(() => localStorage.clear())

  it('should start at the standard pace when the stored one is out of range or garbage', async () => {
    localStorage.setItem('tb.pace', '400')
    expect((await freshPace()).value).toBe(100)
    localStorage.setItem('tb.pace', 'fast')
    expect((await freshPace()).value).toBe(100)
  })

  it('should keep a chosen pace for the next start of the app', async () => {
    const pace = await freshPace()
    pace.value = 120
    await nextTick()
    expect((await freshPace()).value).toBe(120)
  })
})
