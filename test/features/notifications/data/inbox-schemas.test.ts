import { describe, expect, it } from 'vitest'
import { parseInboxRows } from '@/features/notifications/data/models/inbox-schemas'

const valid = {
  id: '11111111-1111-1111-1111-111111111111',
  type: 'tour_updates',
  action: 'updated',
  actor_id: null,
  actor_name: null,
  tour_id: null,
  tour_name: null,
  ref: {},
  occurrences: 1,
  read_at: null,
  created_at: '2026-10-01T00:00:00Z',
}

describe('parseInboxRows', () => {
  it('should drop a row with a type this build does not know', () => {
    expect(parseInboxRows([{ ...valid, type: 'release_notes' }])).toEqual([])
  })

  it('should drop malformed rows and keep the valid ones', () => {
    const rows = parseInboxRows([{ ...valid, occurrences: 0 }, { ...valid, id: 'not-a-uuid' }, valid])
    expect(rows.map(r => r.id)).toEqual([valid.id])
  })
})
