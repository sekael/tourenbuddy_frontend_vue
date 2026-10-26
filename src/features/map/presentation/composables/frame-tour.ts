import type { LngLatLike, Map as MaplibreMap, PaddingOptions } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { LngLatBounds } from 'maplibre-gl'

/** A lone goal's zoom — and the ceiling when framing several points, so close ones look the same. */
export const TOUR_ZOOM = 12
/** Ceiling for framing a chosen ski route: short routes fill the map, a near-point one stays readable. */
export const ROUTE_ZOOM = 15
/** Room around the framed points for the markers themselves (more on top: notch / status bar). */
const MARGIN = { top: 64, right: 48, bottom: 48, left: 48 }
/**
 * Every camera flight's speed — calmer than MapLibre's 1.2 so tiles load as the map moves.
 * About half a second per zoom level; a long hop takes longer than a short one.
 */
export const FLIGHT_SPEED = 1.1

/** `margin` around the framed points, plus whatever the sheet or drawer covers. */
export function paddingBeside(covered: Partial<PaddingOptions>, margin: typeof MARGIN = MARGIN) {
  return {
    top: margin.top + (covered.top ?? 0),
    right: margin.right + (covered.right ?? 0),
    bottom: margin.bottom + (covered.bottom ?? 0),
    left: margin.left + (covered.left ?? 0),
  }
}

/** Whether every corner of `bounds` already lies in the map area left visible beside `covered`. */
export function isBoundsVisible(map: MaplibreMap, bounds: LngLatBounds, covered: Partial<PaddingOptions>): boolean {
  const pad = paddingBeside(covered)
  const { width, height } = map.getContainer().getBoundingClientRect()
  const corners = [bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthWest(), bounds.getSouthEast()]
  return corners.every((c) => {
    const { x, y } = map.project(c)
    return x >= pad.left && x <= width - pad.right && y >= pad.top && y <= height - pad.bottom
  })
}

/**
 * Fly so `bounds` fills the map area left visible beside `covered` (the sheet or
 * drawer), zooming in no further than `maxZoom`. Padding is passed per call and never
 * set on the map: `fitBounds`-style framing adds the map's persistent padding on top.
 */
export function frameBounds(
  map: MaplibreMap,
  bounds: LngLatBounds,
  covered: Partial<PaddingOptions>,
  { fallbackCenter = bounds.getCenter(), maxZoom = TOUR_ZOOM }: { fallbackCenter?: LngLatLike, maxZoom?: number } = {},
) {
  const camera = map.cameraForBounds(bounds, { padding: paddingBeside(covered), maxZoom, bearing: map.getBearing() })
  // No room left to frame in (tiny viewport): just centre on the fallback, no closer
  // than a tour's zoom, so a long route isn't cut down to its middle.
  map.flyTo({ ...(camera ?? { center: fallbackCenter, zoom: Math.min(maxZoom, TOUR_ZOOM) }), speed: FLIGHT_SPEED })
}

/**
 * Frame the tours' goals, starts and ends (whichever exist) — one tour, or every segment of an
 * outing (#338). A lone goal is a zero-size box, so it lands centred at `TOUR_ZOOM`.
 */
export function frameTours(
  map: MaplibreMap,
  tours: Pick<Tour, 'goal' | 'startPoint' | 'endPoint'>[],
  covered: Partial<PaddingOptions>,
) {
  const bounds = new LngLatBounds()
  for (const tour of tours) {
    for (const p of [tour.goal, tour.startPoint, tour.endPoint]) {
      if (p)
        bounds.extend([p.lng, p.lat])
    }
  }
  const first = tours[0]!.goal
  frameBounds(map, bounds, covered, { fallbackCenter: [first.lng, first.lat] })
}
