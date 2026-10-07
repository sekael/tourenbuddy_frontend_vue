import type { Map as MaplibreMap, PaddingOptions } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { LngLatBounds } from 'maplibre-gl'

/** A lone goal's zoom — and the ceiling when framing several points, so close ones look the same. */
export const TOUR_ZOOM = 12
/** Room around the framed points for the markers themselves (more on top: notch / status bar). */
const MARGIN = { top: 64, right: 48, bottom: 48, left: 48 }

/**
 * Fly so the tour's goal, start and end (whichever exist) fill the map area left
 * visible beside `covered` (the sheet or drawer). A lone goal is a zero-size box,
 * so it lands centred at `TOUR_ZOOM`; start = end adds nothing to the box.
 * Padding is passed per call and never set on the map: `fitBounds`-style framing
 * adds the map's persistent padding on top.
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
  const padding = {
    top: MARGIN.top + (covered.top ?? 0),
    right: MARGIN.right + (covered.right ?? 0),
    bottom: MARGIN.bottom + (covered.bottom ?? 0),
    left: MARGIN.left + (covered.left ?? 0),
  }
  const camera = map.cameraForBounds(bounds, { padding, maxZoom: TOUR_ZOOM, bearing: map.getBearing() })
  // No room left to frame in (tiny viewport): just centre the goal.
  map.flyTo({ ...(camera ?? { center: [tour.goal.lng, tour.goal.lat], zoom: TOUR_ZOOM }), duration: 1000 })
}
