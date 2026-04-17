import { z } from 'zod'

export const TOUR_TYPE_VALUES = [
  'skiing',
  'snowboarding',
  'skitour',
  'splitboarding',
  'ski-mountaineering',
  'paragliding',
  'hiking',
  'mountaineering',
  'climbing',
  'mountain-biking',
  'trailrunning',
] as const

export const tourTypeSchema = z.enum(TOUR_TYPE_VALUES)

export type TourType = z.infer<typeof tourTypeSchema>

export const TOUR_TYPE_LABELS: Record<TourType, string> = {
  'skiing': 'Skiing',
  'snowboarding': 'Snowboarding',
  'skitour': 'Ski Tour',
  'splitboarding': 'Splitboarding',
  'ski-mountaineering': 'Ski Mountaineering',
  'paragliding': 'Paragliding',
  'hiking': 'Hiking',
  'mountaineering': 'Mountaineering',
  'climbing': 'Climbing',
  'mountain-biking': 'Mountain Biking',
  'trailrunning': 'Trail Running',
}

export const TOUR_TYPE_ICONS: Record<TourType, string> = {
  'skiing': 'downhill_skiing',
  'snowboarding': 'snowboarding',
  'skitour': 'nordic_walking',
  'splitboarding': 'nordic_walking',
  'ski-mountaineering': 'terrain',
  'paragliding': 'paragliding',
  'hiking': 'hiking',
  'mountaineering': 'landscape',
  'climbing': 'landscape',
  'mountain-biking': 'directions_bike',
  'trailrunning': 'sprint',
}

export const TOUR_TYPE_COLORS: Record<TourType, string> = {
  'skiing': '#1565C0',
  'snowboarding': '#1565C0',
  'skitour': '#1565C0',
  'splitboarding': '#1565C0',
  'ski-mountaineering': '#1565C0',
  'paragliding': '#D97706',
  'hiking': '#DC2626',
  'mountaineering': '#DC2626',
  'climbing': '#DC2626',
  'mountain-biking': '#DC2626',
  'trailrunning': '#DC2626',
}

export const TOUR_TYPE_PREVIEW_COLORS: Record<TourType, string> = {
  'skiing': '#60A5FA',
  'snowboarding': '#60A5FA',
  'skitour': '#60A5FA',
  'splitboarding': '#60A5FA',
  'ski-mountaineering': '#60A5FA',
  'paragliding': '#FCD34D',
  'hiking': '#FCA5A5',
  'mountaineering': '#FCA5A5',
  'climbing': '#FCA5A5',
  'mountain-biking': '#FCA5A5',
  'trailrunning': '#FCA5A5',
}
