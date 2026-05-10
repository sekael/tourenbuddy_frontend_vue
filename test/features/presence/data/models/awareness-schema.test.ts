import { describe, expect, it } from 'vitest'
import { parseAwarenessState } from '@/features/presence/data/models/awareness-schema'

const validUser = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'Ada',
  color: '#e63946',
}

describe('parseAwarenessState', () => {
  it('parses a valid payload', () => {
    const parsed = parseAwarenessState({
      user: validUser,
      cursor: { lon: 8.2, lat: 46.8, t: 1_700_000_000_000 },
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.user.id).toBe(validUser.id)
    expect(parsed!.cursor?.lon).toBe(8.2)
  })

  it('returns null for invalid user id', () => {
    expect(
      parseAwarenessState({
        user: { ...validUser, id: 'not-a-uuid' },
        cursor: { lon: 0, lat: 0, t: 1 },
      }),
    ).toBeNull()
  })

  it('treats missing cursor as null', () => {
    const parsed = parseAwarenessState({ user: validUser })
    expect(parsed?.cursor).toBeNull()
  })
})
