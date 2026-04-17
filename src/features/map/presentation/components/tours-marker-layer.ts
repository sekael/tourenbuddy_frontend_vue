import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { TOUR_TYPE_COLORS, TOUR_TYPE_PREVIEW_COLORS } from '@/features/tours/data/models/tour-type'
import { toursToGeoJson } from '@/features/tours/domain/entities/tour'

const SOURCE_ID = 'tours'
const PREVIEW_SOURCE_ID = 'tours-preview'
export const TOUR_LAYER_IDS = ['tours-circles', 'tours-circles-selected'] as const
const LAYER_ID = TOUR_LAYER_IDS[0]
const SELECTED_LAYER_ID = TOUR_LAYER_IDS[1]
const CHECK_LAYER_ID = 'tours-completed-check'
const PREVIEW_LAYER_ID = 'tours-preview-circle'
const CHECK_ICON_ID = 'tour-check-icon'

function buildMatchExpr(
  colors: Record<TourType, string>,
  fallback: string,
): ExpressionSpecification {
  const pairs = Object.entries(colors).flatMap(([type, color]) => [type, color])
  return ['match', ['coalesce', ['get', 'tourType'], 'unknown'], ...pairs, fallback]
}

const COLOR_EXPR = buildMatchExpr(TOUR_TYPE_COLORS, '#78716C')
const PREVIEW_COLOR_EXPR = buildMatchExpr(TOUR_TYPE_PREVIEW_COLORS, '#A8A29E')

/** Loads a check SVG as a MapLibre icon image via addImage. Resolves true on success. */
async function loadCheckIcon(map: MapLibreMap): Promise<boolean> {
  // Image persists across style reloads — skip if already registered.
  if (map.hasImage(CHECK_ICON_ID)) return true

  const size = 28
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
      <polyline
        points="5,14 11,21 23,8"
        stroke="white"
        stroke-width="3.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />
    </svg>
  `.trim()

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image(size, size)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        map.addImage(CHECK_ICON_ID, img, { sdf: false })
        resolve(true)
      } catch {
        resolve(false)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(false)
    }
    img.src = url
  })
}

/**
 * Manages the MapLibre GL circle layers that represent tour markers.
 */
export function useToursMarkerLayer(map: MapLibreMap, onTourClick: (tourId: string) => void) {
  async function setup() {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addSource(PREVIEW_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    // Default circles
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!=', ['get', 'id'], ''],
      paint: {
        'circle-radius': 14,
        'circle-color': COLOR_EXPR,
        'circle-opacity': 0.85,
      },
    })

    // Selected circle (larger, with white stroke)
    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'circle-radius': 18,
        'circle-color': COLOR_EXPR,
        'circle-opacity': 1,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

    // Preview marker shown at a tentative goal location during edit mode
    map.addLayer({
      id: PREVIEW_LAYER_ID,
      type: 'circle',
      source: PREVIEW_SOURCE_ID,
      paint: {
        'circle-radius': 16,
        'circle-color': PREVIEW_COLOR_EXPR,
        'circle-opacity': 0.9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

    // Completed-tour check glyph layer — shown above circle layers
    const iconLoaded = await loadCheckIcon(map)
    if (iconLoaded) {
      map.addLayer({
        id: CHECK_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['==', ['get', 'completed'], true],
        layout: {
          'icon-image': CHECK_ICON_ID,
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      })
    }

    map.on('click', LAYER_ID, (e) => {
      const feature = e.features?.[0]
      if (feature?.properties?.id) {
        onTourClick(feature.properties.id as string)
      }
    })

    map.on('mouseenter', LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', LAYER_ID, () => {
      map.getCanvas().style.cursor = ''
    })
  }

  function updateTours(tours: Tour[], selectedTourId: string | null) {
    const source = map.getSource(SOURCE_ID)
    if (!source || source.type !== 'geojson') return

    source.setData(toursToGeoJson(tours))

    // Update filter for selected layer
    map.setFilter(LAYER_ID, ['!=', ['get', 'id'], selectedTourId ?? ''])
    map.setFilter(SELECTED_LAYER_ID, ['==', ['get', 'id'], selectedTourId ?? ''])
  }

  function updatePreview(goal: { lng: number; lat: number } | null, tourType: TourType | null) {
    const source = map.getSource(PREVIEW_SOURCE_ID)
    if (!source || source.type !== 'geojson') return

    source.setData({
      type: 'FeatureCollection',
      features: goal
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [goal.lng, goal.lat] },
              properties: { tourType: tourType ?? null },
            },
          ]
        : [],
    })
  }

  return { setup, updateTours, updatePreview }
}
