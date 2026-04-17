import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { toursToGeoJson } from '@/features/tours/domain/entities/tour'

const SOURCE_ID = 'tours'
const PREVIEW_SOURCE_ID = 'tours-preview'
export const TOUR_LAYER_IDS = ['tours-circles', 'tours-circles-selected'] as const
const LAYER_ID = TOUR_LAYER_IDS[0]
const SELECTED_LAYER_ID = TOUR_LAYER_IDS[1]
const PREVIEW_LAYER_ID = 'tours-preview-circle'

/**
 * Manages the MapLibre GL circle layers that represent tour markers.
 */
export function useToursMarkerLayer(map: MapLibreMap, onTourClick: (tourId: string) => void) {
  function setup() {
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
        'circle-color': '#e65100',
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
        'circle-color': '#e65100',
        'circle-opacity': 1,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

    // Orange preview marker shown at a tentative goal location during edit mode
    map.addLayer({
      id: PREVIEW_LAYER_ID,
      type: 'circle',
      source: PREVIEW_SOURCE_ID,
      paint: {
        'circle-radius': 16,
        'circle-color': '#ff9800',
        'circle-opacity': 0.9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

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
    if (!source || source.type !== 'geojson')
      return

    source.setData(toursToGeoJson(tours))

    // Update filter for selected layer
    map.setFilter(LAYER_ID, ['!=', ['get', 'id'], selectedTourId ?? ''])
    map.setFilter(SELECTED_LAYER_ID, ['==', ['get', 'id'], selectedTourId ?? ''])
  }

  function updatePreview(goal: { lng: number, lat: number } | null) {
    const source = map.getSource(PREVIEW_SOURCE_ID)
    if (!source || source.type !== 'geojson')
      return

    source.setData({
      type: 'FeatureCollection',
      features: goal
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [goal.lng, goal.lat] },
              properties: {},
            },
          ]
        : [],
    })
  }

  return { setup, updateTours, updatePreview }
}
