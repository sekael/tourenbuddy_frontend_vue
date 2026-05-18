import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { useLogger } from '@/core/logging/use-logger'
import { useGpxCache } from '@/features/map/presentation/composables/use-gpx-cache'
import { TOUR_TYPE_TRACK_COLORS } from '@/features/tours/data/models/tour-type'
import { parseGpxFile } from '@/features/tours/data/services/gpx-parser'
import { getSignedUrl } from '@/features/tours/data/services/gpx-storage-service'
import { TOUR_LAYER_IDS } from './tours-marker-layer'

const GPX_SOURCE_ID = 'gpx-track'
const GPX_LAYER_ID = 'gpx-track-line'
const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const FALLBACK_TRACK_COLOR = '#555555'

function buildColorExpression(): ExpressionSpecification {
  const pairs: (string | ExpressionSpecification)[] = []
  for (const [type, color] of Object.entries(TOUR_TYPE_TRACK_COLORS)) {
    pairs.push(type, color)
  }
  return ['match', ['get', 'tourType'], ...pairs, FALLBACK_TRACK_COLOR]
}

export function useGpxTrackLayer(map: MapLibreMap) {
  const logger = useLogger('GpxTrackLayer')
  const cache = useGpxCache()

  function setup() {
    map.addSource(GPX_SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_GEOJSON,
    })

    const beforeId = TOUR_LAYER_IDS.find(id => map.getLayer(id))
    map.addLayer(
      {
        id: GPX_LAYER_ID,
        type: 'line',
        source: GPX_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': buildColorExpression(),
          'line-width': 3,
          'line-opacity': 0.85,
        },
      },
      beforeId,
    )
  }

  function clearTrack() {
    const source = map.getSource(GPX_SOURCE_ID)
    if (source && source.type === 'geojson')
      source.setData(EMPTY_GEOJSON)
  }

  async function updateTrack(tour: Tour | null) {
    const source = map.getSource(GPX_SOURCE_ID)
    if (!source || source.type !== 'geojson')
      return

    if (!tour?.gpxFilepath) {
      source.setData(EMPTY_GEOJSON)
      return
    }

    function annotate(geojson: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
      return {
        ...geojson,
        features: geojson.features.map(f => ({
          ...f,
          properties: { ...f.properties, tourType: tour!.tourType ?? null },
        })),
      }
    }

    const cached = cache.get(tour.id)
    if (cached) {
      source.setData(annotate(cached))
      return
    }

    try {
      const signedUrl = await getSignedUrl(tour.gpxFilepath)
      const response = await fetch(signedUrl)
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const file = new File([blob], `${tour.id}.gpx`, { type: 'application/gpx+xml' })
      const geojson = await parseGpxFile(file)

      cache.set(tour.id, geojson)
      source.setData(annotate(geojson))
    }
    catch (err) {
      logger.error('Failed to load GPX track', err)
      source.setData(EMPTY_GEOJSON)
    }
  }

  return { setup, updateTrack, clearTrack }
}

export const GPX_LAYER_ID_EXPORT = GPX_LAYER_ID
