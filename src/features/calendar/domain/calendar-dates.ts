/** A single cell in the month grid. */
export interface MonthCell {
  date: Date
  /** False for leading/trailing days that belong to the adjacent month. */
  inMonth: boolean
}

/**
 * Build a Monday-start, 6-week (42-cell) grid covering the month that
 * `viewDate` falls in, including the leading/trailing adjacent-month days that
 * fill the first and last weeks. Six rows are always emitted so the grid height
 * never jumps between months.
 */
export function buildMonthGrid(viewDate: Date): MonthCell[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  // JS getDay(): 0=Sun … 6=Sat. Shift so Monday=0 … Sunday=6.
  const mondayOffset = (first.getDay() + 6) % 7
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(year, month, 1 - mondayOffset + i)
    cells.push({ date, inMonth: date.getMonth() === month })
  }
  return cells
}

/**
 * Local-time `YYYY-MM-DD` key for bucketing tours onto calendar days. Uses the
 * date's own local components (not `toISOString`, which would shift across the
 * UTC boundary and land a tour on the wrong day).
 */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
