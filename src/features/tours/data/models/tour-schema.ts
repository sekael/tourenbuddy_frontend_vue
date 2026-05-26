import { z } from 'zod'
import { seasonSchema } from './season'
import { tourTypeSchema } from './tour-type'
import { visibilitySchema } from './visibility'

const pointSchema = z.object({ lng: z.number(), lat: z.number() })

/** A tour partner surfaced to a friend viewer: a registered user, by profile name. */
const partnerNameSchema = z.object({
  userId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
})

export type PartnerName = z.infer<typeof partnerNameSchema>

/** Raw shape from Supabase `tours_view` (snake_case). */
export const tourRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    planned_date: z.string().nullable(),
    lon: z.number(),
    lat: z.number(),
    name: z.string().nullable(),
    partner_ids: z.array(z.string()).default([]),
    tour_type: tourTypeSchema.nullable().default(null),
    elevation: z.number().nullable().default(null),
    gpx_filepath: z.string().nullable().default(null),
    description: z.string().nullable().default(null),
    seasons: z.array(seasonSchema).nullable().default(null),
    start_lon: z.number().nullable().default(null),
    start_lat: z.number().nullable().default(null),
    end_lon: z.number().nullable().default(null),
    end_lat: z.number().nullable().default(null),
    start_point_name: z.string().nullable().default(null),
    start_point_elevation: z.number().int().nullable().default(null),
    end_point_name: z.string().nullable().default(null),
    end_point_elevation: z.number().int().nullable().default(null),
    equipment: z.string().nullable().default(null),
    notes: z.string().nullable().default(null),
    completed: z.boolean().default(false),
    visibility: visibilitySchema.default('friends'),
  })
  .transform(row => ({
    id: row.id,
    userId: row.user_id,
    plannedDate: row.planned_date ? new Date(row.planned_date) : null,
    goal: { lng: row.lon, lat: row.lat },
    name: row.name,
    partnerIds: row.partner_ids,
    tourType: row.tour_type,
    elevation: row.elevation,
    gpxFilepath: row.gpx_filepath,
    description: row.description,
    seasons: row.seasons,
    startPoint:
      row.start_lon != null && row.start_lat != null
        ? { lng: row.start_lon, lat: row.start_lat }
        : null,
    endPoint:
      row.end_lon != null && row.end_lat != null ? { lng: row.end_lon, lat: row.end_lat } : null,
    startPointName: row.start_point_name,
    startPointElevation: row.start_point_elevation,
    endPointName: row.end_point_name,
    endPointElevation: row.end_point_elevation,
    equipment: row.equipment,
    notes: row.notes,
    completed: row.completed,
    visibility: row.visibility,
    isFriendTour: false,
  }))

/** Domain-level tour shape. */
export const tourSchema = z.object({
  id: z.string(),
  userId: z.string(),
  plannedDate: z.coerce.date().nullable(),
  goal: pointSchema,
  name: z.string().nullable(),
  partnerIds: z.array(z.string()),
  tourType: tourTypeSchema.nullable(),
  elevation: z.number().nullable(),
  gpxFilepath: z.string().nullable(),
  description: z.string().nullable(),
  seasons: z.array(seasonSchema).nullable(),
  startPoint: pointSchema.nullable(),
  endPoint: pointSchema.nullable(),
  startPointName: z.string().nullable(),
  startPointElevation: z.number().nullable(),
  endPointName: z.string().nullable(),
  endPointElevation: z.number().nullable(),
  equipment: z.string().nullable(),
  notes: z.string().nullable(),
  completed: z.boolean(),
  visibility: visibilitySchema,
  /** True when this tour belongs to a friend (read via friend_tours_view), not the viewer. */
  isFriendTour: z.boolean().default(false),
  /** Friend-tour only: whether the viewer is a marked partner (drives detail gating). */
  isPartner: z.boolean().optional(),
  /** Friend-tour only: partners as registered-user names (owner contacts never exposed). */
  partnerNames: z.array(partnerNameSchema).optional(),
})

/**
 * Raw shape from `friend_tours_view`. Gated columns (planned_date, gpx_filepath)
 * arrive null for non-partner viewers; partners surface as `partner_names`, never
 * the owner's raw contact ids. Maps to the same domain `Tour` with `isFriendTour`.
 */
export const friendTourRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    planned_date: z.string().nullable(),
    lon: z.number(),
    lat: z.number(),
    name: z.string().nullable(),
    tour_type: tourTypeSchema.nullable().default(null),
    elevation: z.number().nullable().default(null),
    gpx_filepath: z.string().nullable().default(null),
    description: z.string().nullable().default(null),
    seasons: z.array(seasonSchema).nullable().default(null),
    start_lon: z.number().nullable().default(null),
    start_lat: z.number().nullable().default(null),
    end_lon: z.number().nullable().default(null),
    end_lat: z.number().nullable().default(null),
    start_point_name: z.string().nullable().default(null),
    start_point_elevation: z.number().int().nullable().default(null),
    end_point_name: z.string().nullable().default(null),
    end_point_elevation: z.number().int().nullable().default(null),
    equipment: z.string().nullable().default(null),
    notes: z.string().nullable().default(null),
    completed: z.boolean().default(false),
    is_partner: z.boolean().default(false),
    partner_names: z.array(partnerNameSchema).default([]),
    visibility: visibilitySchema.default('friends'),
  })
  .transform(row => ({
    id: row.id,
    userId: row.user_id,
    plannedDate: row.planned_date ? new Date(row.planned_date) : null,
    goal: { lng: row.lon, lat: row.lat },
    name: row.name,
    partnerIds: [] as string[],
    tourType: row.tour_type,
    elevation: row.elevation,
    gpxFilepath: row.gpx_filepath,
    description: row.description,
    seasons: row.seasons,
    startPoint:
      row.start_lon != null && row.start_lat != null
        ? { lng: row.start_lon, lat: row.start_lat }
        : null,
    endPoint:
      row.end_lon != null && row.end_lat != null ? { lng: row.end_lon, lat: row.end_lat } : null,
    startPointName: row.start_point_name,
    startPointElevation: row.start_point_elevation,
    endPointName: row.end_point_name,
    endPointElevation: row.end_point_elevation,
    equipment: row.equipment,
    notes: row.notes,
    completed: row.completed,
    visibility: row.visibility,
    isFriendTour: true,
    isPartner: row.is_partner,
    partnerNames: row.partner_names,
  }))
