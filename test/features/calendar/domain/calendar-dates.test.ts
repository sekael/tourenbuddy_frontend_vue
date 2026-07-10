import { describe, expect, it } from 'vitest'
import { buildMonthGrid, dayKey } from '@/features/calendar/domain/calendar-dates'

describe('buildMonthGrid', () => {
  it('always emits a 6-week, 42-cell grid', () => {
    expect(buildMonthGrid(new Date(2024, 5, 1))).toHaveLength(42)
  })

  it('starts the grid on the Monday on/before the 1st (June 2024 starts Sat)', () => {
    // June 1 2024 is a Saturday → grid starts Mon May 27.
    const grid = buildMonthGrid(new Date(2024, 5, 15))
    expect(grid[0].date).toEqual(new Date(2024, 4, 27))
    expect(grid[0].inMonth).toBe(false)
  })

  it('pads a month whose 1st is Monday with no leading days', () => {
    // April 2024 starts on a Monday.
    const grid = buildMonthGrid(new Date(2024, 3, 10))
    expect(grid[0].date).toEqual(new Date(2024, 3, 1))
    expect(grid[0].inMonth).toBe(true)
  })

  it('marks trailing days from the next month as out-of-month', () => {
    const grid = buildMonthGrid(new Date(2024, 5, 1))
    expect(grid[41].inMonth).toBe(false)
    expect(grid[41].date.getMonth()).toBe(6) // July
  })
})

describe('dayKey', () => {
  it('uses local components, not a UTC-shifted ISO date', () => {
    // 23:30 local should still key to that local day, never roll to the next.
    expect(dayKey(new Date(2024, 5, 15, 23, 30))).toBe('2024-06-15')
  })

  it('zero-pads month and day', () => {
    expect(dayKey(new Date(2024, 0, 5))).toBe('2024-01-05')
  })
})
