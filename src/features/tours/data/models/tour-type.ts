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
  skiing: 'Skiing',
  snowboarding: 'Snowboarding',
  skitour: 'Ski Tour',
  splitboarding: 'Splitboarding',
  'ski-mountaineering': 'Ski Mountaineering',
  paragliding: 'Paragliding',
  hiking: 'Hiking',
  mountaineering: 'Mountaineering',
  climbing: 'Climbing',
  'mountain-biking': 'Mountain Biking',
  trailrunning: 'Trail Running',
}

export const TOUR_TYPE_ICONS: Record<TourType, string> = {
  skiing: 'downhill_skiing',
  snowboarding: 'snowboarding',
  skitour: 'nordic_walking',
  splitboarding: 'nordic_walking',
  'ski-mountaineering': 'terrain',
  paragliding: 'paragliding',
  hiking: 'hiking',
  mountaineering: 'landscape',
  climbing: 'landscape',
  'mountain-biking': 'directions_bike',
  trailrunning: 'sprint',
}
