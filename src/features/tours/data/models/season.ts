import { z } from 'zod'

export const SEASON_VALUES = ['winter', 'spring', 'summer', 'autumn'] as const

export const seasonSchema = z.enum(SEASON_VALUES)

export type Season = z.infer<typeof seasonSchema>

export const SEASON_LABELS: Record<Season, string> = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
}
