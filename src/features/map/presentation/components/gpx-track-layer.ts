import type { Map as MapLibreMap } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'

const GPX_SOURCE_ID = 'gpx-track'
const GPX_LAYER_ID = 'gpx-track-line'

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Manages the MapLibre GL line layer that renders a selected tour's GPX track.
 */
export function useGpxTrackLayer(map: MapLibreMap) {
  function setup() {
    map.addSource(GPX_SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_GEOJSON,
    })

    map.addLayer({
      id: GPX_LAYER_ID,
      type: 'line',
      source: GPX_SOURCE_ID,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#e65100',
        'line-width': 3,
        'line-opacity': 0.8,
      },
    })
  }

  function updateTrack(tour: Tour | null) {
    const source = map.getSource(GPX_SOURCE_ID)
    if (!source || source.type !== 'geojson')
      return

    if (tour?.gpxTrack) {
      source.setData(tour.gpxTrack as GeoJSON.FeatureCollection)
    }
    else {
      source.setData(EMPTY_GEOJSON)
    }
  }

  return { setup, updateTrack }
}

export const GPX_LAYER_ID_EXPORT = GPX_LAYER_ID
