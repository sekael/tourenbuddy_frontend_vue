import type { TourType } from '@/features/tours/data/models/tour-type'
import { TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'

/** DB CHECK `tours_grade_check`. */
export const GRADE_MAX_LENGTH = 20

const HIKING = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const
const ALPINE = ['L', 'WS', 'ZS', 'S', 'SS', 'AS', 'EX'] as const
const SINGLETRAIL = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'] as const

/**
 * Closed grade scales offered as chips (design D3): the SAC hiking scale, the SAC ski-touring /
 * mountaineering scale (modifiers + / − are typed) and the singletrail scale. Climbing has two
 * scales in use (French, UIAA) and gets an example instead; resort skiing, snowboarding and
 * paragliding have none — their field stays free text.
 */
export const GRADE_SCALES: Partial<Record<TourType, readonly string[]>> = {
  'hiking': HIKING,
  'trailrunning': HIKING,
  'skitour': ALPINE,
  'splitboarding': ALPINE,
  'ski-mountaineering': ALPINE,
  'mountaineering': ALPINE,
  'mountain-biking': SINGLETRAIL,
}

export interface GradeScale {
  /** The first selected activity using it — the row's icon. */
  type: TourType
  grades: readonly string[]
}

/** The chips for the selected activities, each scale once, in activity order. */
export function gradeScales(types: readonly TourType[]): GradeScale[] {
  const scales = new Map<readonly string[], TourType>()
  for (const type of TOUR_TYPE_VALUES) {
    const grades = GRADE_SCALES[type]
    if (grades && types.includes(type) && !scales.has(grades))
      scales.set(grades, type)
  }
  return [...scales].map(([grades, type]) => ({ type, grades }))
}

// One grade per scale, comma-separated: a bike-and-hike is "S2, T4", a ridge "ZS+, 5c".
const SEPARATOR = /\s*[,;·]\s*/
const tokens = (grade: string) => grade.split(SEPARATOR).filter(Boolean)
const join = (parts: string[]) => parts.join(', ')

/** The scale grade a part leads with, canonical: "zs+ (III)" → ZS, "WS+/ZS-" → WS, "5c" → null. */
function leading(part: string): string | null {
  const head = /^[a-z]+\d?/i.exec(part)?.[0].toUpperCase() ?? null
  return scaleOf(head) ? head : null
}
function scaleOf(grade: string | null) {
  return grade ? Object.values(GRADE_SCALES).find(s => s.includes(grade)) : undefined
}

/** The scale grades the text holds, canonical — the chips to light. */
export function gradeLeads(grade: string): string[] {
  return tokens(grade).map(leading).filter(g => g != null)
}

/**
 * A chip tap: sets its scale's part (replacing that scale's earlier one, keeping the others),
 * or clears it when it already leads with this grade.
 */
export function toggleGrade(grade: string, chip: string): string {
  const parts = tokens(grade)
  const i = parts.findIndex(p => scaleOf(leading(p)) === scaleOf(chip))
  if (i < 0)
    return join([...parts, chip])
  if (leading(parts[i]!) === chip)
    return join(parts.filter((_, j) => j !== i))
  return join(parts.map((p, j) => (j === i ? chip : p)))
}

/** Drops the parts of scales no activity uses any more — a T3 doesn't outlive the hike. */
export function dropScales(grade: string, scales: readonly GradeScale[]): string {
  const gone = new Set(scales.map(s => s.grades))
  return join(tokens(grade).filter((p) => {
    const scale = scaleOf(leading(p))
    return !scale || !gone.has(scale)
  }))
}

/** Every closed scale once, for the tour list's grade filter (#351). */
export const FILTER_GRADE_SCALES: GradeScale[] = gradeScales(TOUR_TYPE_VALUES)

/** The closed scale a canonical grade belongs to ("ZS" → L–EX); undefined for free text. */
export function gradeScaleOf(grade: string): readonly string[] | undefined {
  return scaleOf(grade)
}

/** An inclusive range on one scale, `from` at or below `to`: "T3 max" is T1–T3. */
export interface GradeRange {
  from: string
  to: string
}

/**
 * A grade-filter chip tap, the booking-calendar way: a first tap picks one grade, a second widens
 * the pick to it, a further tap starts over there; tapping a lone pick clears its scale.
 */
export function tapGradeRange(ranges: readonly GradeRange[], chip: string): GradeRange[] {
  const scale = scaleOf(chip)!
  const others = ranges.filter(r => scaleOf(r.from) !== scale)
  const own = ranges.find(r => scaleOf(r.from) === scale)
  if (own && own.from === own.to && own.from === chip)
    return others
  if (!own || own.from !== own.to)
    return [...others, { from: chip, to: chip }]
  const [from, to] = [own.from, chip].sort((a, b) => scale.indexOf(a) - scale.indexOf(b)) as [string, string]
  return [...others, { from, to }]
}

/**
 * Whether a tour's grade passes the ranges: at least one part lies on a filtered scale and every
 * such part lies within its range ("nothing above S2" holds for a bike-and-hike too). A part counts
 * as the grade it leads with, so ZS+ is ZS; free text ("5c") never matches.
 */
export function gradeInRanges(grade: string | null, ranges: readonly GradeRange[]): boolean {
  let hit = false
  for (const lead of grade ? gradeLeads(grade) : []) {
    const scale = scaleOf(lead)!
    const range = ranges.find(r => scaleOf(r.from) === scale)
    if (!range)
      continue
    const i = scale.indexOf(lead)
    if (i < scale.indexOf(range.from) || i > scale.indexOf(range.to))
      return false
    hit = true
  }
  return hit
}

/** As stored: trimmed, comma-separated, scale grades in their capitals ("zs+" → "ZS+"). */
export function normalizeGrade(grade: string): string {
  return join(tokens(grade.trim()).map((p) => {
    const head = leading(p)
    return head ? head + p.slice(head.length) : p
  }))
}
