import type { LngLatLike, Map as MaplibreMap, PaddingOptions } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { LngLatBounds } from 'maplibre-gl'

/** A lone goal's zoom — and the ceiling when framing several points, so close ones look the same. */
export const TOUR_ZOOM = 12
/** Room around the framed points for the markers themselves (more on top: notch / status bar). */
const MARGIN = { top: 64, right: 48, bottom: 48, left: 48 }

function paddingBeside(covered: Partial<PaddingOptions>) {
  return {
    top: MARGIN.top + (covered.top ?? 0),
    right: MARGIN.right + (covered.right ?? 0),
    bottom: MARGIN.bottom + (covered.bottom ?? 0),
    left: MARGIN.left + (covered.left ?? 0),
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
 * drawer), zooming in no further than `TOUR_ZOOM`. Padding is passed per call and never
 * set on the map: `fitBounds`-style framing adds the map's persistent padding on top.
 */
export function frameBounds(
  map: MaplibreMap,
  bounds: LngLatBounds,
  covered: Partial<PaddingOptions>,
  fallbackCenter: LngLatLike = bounds.getCenter(),
) {
  const camera = map.cameraForBounds(bounds, { padding: paddingBeside(covered), maxZoom: TOUR_ZOOM, bearing: map.getBearing() })
  // No room left to frame in (tiny viewport): just centre on the fallback.
  map.flyTo({ ...(camera ?? { center: fallbackCenter, zoom: TOUR_ZOOM }), duration: 1000 })
}

/**
 * Frame the tour's goal, start and end (whichever exist). A lone goal is a zero-size
 * box, so it lands centred at `TOUR_ZOOM`; start = end adds nothing to the box.
 */
export function frameTour(
  map: MaplibreMap,
  tour: Pick<Tour, 'goal' | 'startPoint' | 'endPoint'>,
  covered: Partial<PaddingOptions>,
) {
  const bounds = new LngLatBounds()
  for (const p of [tour.goal, tour.startPoint, tour.endPoint]) {
    if (p)
      bounds.extend([p.lng, p.lat])
  }
  frameBounds(map, bounds, covered, [tour.goal.lng, tour.goal.lat])
}
