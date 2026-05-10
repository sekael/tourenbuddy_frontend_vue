import { describe, expect, it } from 'vitest'
import { colorForUserId, PRESENCE_PALETTE } from '@/features/presence/data/presence-palette'

describe('presence-palette', () => {
  it('returns a stable color for the same user id', () => {
    const id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    expect(colorForUserId(id)).toBe(colorForUserId(id))
  })

  it('returns a member of the palette', () => {
    const id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'
    expect(PRESENCE_PALETTE).toContain(colorForUserId(id))
  })
})
