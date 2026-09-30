import ICAL from 'ical.js'
import { zurichWallTime } from './zurich'

export interface Occurrence { start: Date, end: Date }

// A pathological RRULE (FREQ=MINUTELY since 2010) would burn the Worker's CPU budget.
// ponytail: flat cap, fails the feed closed; anchor the iterator near `from` if real feeds hit it.
const MAX_ITERATIONS = 20_000

export class IcsParseError extends Error {
  constructor(readonly code: 'unparseable' | 'too_complex') {
    super(code)
  }
}

/** Absolute instant of an ICAL time. Floating / unknown-TZID times are read as Zurich wall time. */
function toDate(t: ICAL.Time): Date {
  const tzid = t.zone?.tzid
  if (!tzid || tzid === 'floating')
    return zurichWallTime(t.toString().slice(0, 10), `${t.hour}:${t.minute}:${t.second}`)
  return t.toJSDate()
}

function isSkipped(event: ICAL.Event): boolean {
  return event.startDate.isDate // all-day: no time to intersect with the core window (D4)
    || event.uid?.endsWith('@tourenbuddy') // our own outbound feed echoed back (D7)
    || event.component.getFirstPropertyValue('status') === 'CANCELLED'
    || event.component.getFirstPropertyValue('transp') === 'TRANSPARENT' // "show as free"
}

/**
 * Timed occurrences overlapping [from, to), recurrences expanded. Throws on a body that is
 * not iCalendar — an empty result must mean "no events", never "could not read" (D5).
 */
export function parseIcs(body: string, from: Date, to: Date): Occurrence[] {
  let root: ICAL.Component
  try {
    root = new ICAL.Component(ICAL.parse(body) as unknown[])
  }
  catch {
    throw new IcsParseError('unparseable')
  }
  if (root.name !== 'vcalendar')
    throw new IcsParseError('unparseable')

  for (const tz of root.getAllSubcomponents('vtimezone'))
    ICAL.TimezoneService.register(tz)

  // Exceptions (RECURRENCE-ID) attach to their master so the iterator yields the moved time.
  const masters = new Map<string, ICAL.Event>()
  const exceptions: ICAL.Event[] = []
  for (const c of root.getAllSubcomponents('vevent')) {
    const e = new ICAL.Event(c)
    if (e.isRecurrenceException())
      exceptions.push(e)
    else masters.set(e.uid, e)
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid)
    if (master)
      master.relateException(ex)
    else masters.set(`${ex.uid}#${ex.recurrenceId}`, ex)
  }

  const out: Occurrence[] = []
  const push = (start: Date, end: Date) => {
    if (start < to && end > from)
      out.push({ start, end })
  }

  for (const event of masters.values()) {
    if (isSkipped(event))
      continue
    if (!event.isRecurring()) {
      push(toDate(event.startDate), toDate(event.endDate))
      continue
    }
    const it = event.iterator()
    let n = 0
    for (let next = it.next(); next; next = it.next()) {
      if (++n > MAX_ITERATIONS)
        throw new IcsParseError('too_complex')
      const occ = event.getOccurrenceDetails(next)
      const start = toDate(occ.startDate)
      if (start >= to)
        break
      if (occ.item !== event && isSkipped(occ.item))
        continue
      push(start, toDate(occ.endDate))
    }
  }
  return out
}
