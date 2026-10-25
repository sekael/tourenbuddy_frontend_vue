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

export const TOUR_TYPE_I18N_KEYS: Record<TourType, string> = {
  'skiing': 'skiing',
  'snowboarding': 'snowboarding',
  'skitour': 'skitour',
  'splitboarding': 'splitboarding',
  'ski-mountaineering': 'skiMountaineering',
  'paragliding': 'paragliding',
  'hiking': 'hiking',
  'mountaineering': 'mountaineering',
  'climbing': 'climbing',
  'mountain-biking': 'mountainBiking',
  'trailrunning': 'trailrunning',
}

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
  'skitour': 'ski_touring',
  'splitboarding': 'splitboarding',
  'ski-mountaineering': 'ski_mountaineering',
  'paragliding': 'paragliding',
  'hiking': 'hiking',
  'mountaineering': 'mountaineering',
  'climbing': 'climbing',
  'mountain-biking': 'directions_bike',
  'trailrunning': 'sprint',
}

/**
 * Marker colour per activity: winter blue, flying orange, summer red — the bike violet, so a hike
 * & bike's way up and way down tell apart on the map (activity-legs).
 */
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
  'mountain-biking': '#7C3AED',
  'trailrunning': '#DC2626',
}

export const TOUR_TYPE_TRACK_COLORS: Record<TourType, string> = {
  'skiing': '#0c396d',
  'snowboarding': '#0c396d',
  'skitour': '#0c396d',
  'splitboarding': '#0c396d',
  'ski-mountaineering': '#0c396d',
  'paragliding': '#804604',
  'hiking': '#8f1717',
  'mountaineering': '#8f1717',
  'climbing': '#8f1717',
  'mountain-biking': '#4f11ba',
  'trailrunning': '#8f1717',
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
  'mountain-biking': '#C4B5FD',
  'trailrunning': '#FCA5A5',
}

/**
 * The distinct palette colours of a tour's types, in type order — e.g. skitour + splitboarding
 * is one blue, skitour + hiking is blue then red. Empty for an untyped tour.
 */
export function distinctTypeColors(
  types: readonly TourType[],
  palette: Record<TourType, string>,
): string[] {
  return [...new Set(types.map(t => palette[t]))]
}

/** CSS background split like a marker: solid, or equal conic slices from 12 o'clock (map dots, outing badges). */
export function cssFill(colors: readonly string[]): string {
  if (colors.length === 1)
    return colors[0]!
  const step = 100 / colors.length
  return `conic-gradient(${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`
}
