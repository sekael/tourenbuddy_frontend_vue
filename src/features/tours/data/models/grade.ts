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

/** The chips for the selected activities, each scale once, in activity order. */
export function gradeScales(types: readonly TourType[]): (readonly string[])[] {
  return [...new Set(TOUR_TYPE_VALUES.filter(t => types.includes(t)).map(t => GRADE_SCALES[t]).filter(s => s != null))]
}
