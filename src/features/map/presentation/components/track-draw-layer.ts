import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { DrawnTrack } from '@/features/map/domain/drawn-track'
import type { LngLat } from '@/features/map/domain/entities/trail'
import { ARROW_LAYER_ID } from './gpx-track-layer'

/** The drawing red (MapLibre paint needs a literal): swisstopo draws a tour in this tone. */
const TRACK_RED = '#e3061b'

/**
 * A drawn track on the map, the way the swisstopo app draws one: a red line on a white casing,
 * red end dots ringed in white, white dots ringed red for the points between, and a faint dot
 * where a tap waits for its leg. `withPoints: false` draws the line alone (an unsaved track
 * behind the form). The line runs with the tracks, under the markers and their labels; the dots
 * sit on top, so every point stays in reach of a finger.
 */
export function useTrackDrawLayer(map: MapLibreMap, id: string, { withPoints = true } = {}) {
  const lineId = `${id}-line`
  const casingId = `${id}-casing`
  const pointsId = `${id}-points`

  function setup() {
    if (map.getSource(id))
      return
    map.addSource(id, { type: 'geojson', data: empty() })
    const layout = { 'line-join': 'round', 'line-cap': 'round' } as const
    const below = map.getLayer(ARROW_LAYER_ID) ? ARROW_LAYER_ID : undefined
    map.addLayer({ id: casingId, type: 'line', source: id, filter: ['==', '$type', 'LineString'], layout, paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } }, below)
    map.addLayer({ id: lineId, type: 'line', source: id, filter: ['==', '$type', 'LineString'], layout, paint: { 'line-color': TRACK_RED, 'line-width': 5 } }, below)
    if (!withPoints)
      return
    map.addLayer({
      id: pointsId,
      type: 'circle',
      source: id,
      filter: ['==', '$type', 'Point'],
      paint: {
        'circle-radius': ['match', ['get', 'role'], 'end', 8, 5],
        'circle-color': ['match', ['get', 'role'], 'end', TRACK_RED, '#ffffff'],
        'circle-stroke-color': ['match', ['get', 'role'], 'end', '#ffffff', TRACK_RED],
        'circle-stroke-width': 3,
        'circle-opacity': ['match', ['get', 'role'], 'queued', 0.6, 1],
        'circle-stroke-opacity': ['match', ['get', 'role'], 'queued', 0.6, 1],
      },
    })
  }

  function update({ points, legs }: DrawnTrack, queued: readonly LngLat[] = []) {
    const point = (coordinates: LngLat, role: string): GeoJSON.Feature => ({ type: 'Feature', properties: { role }, geometry: { type: 'Point', coordinates } })
    const features: GeoJSON.Feature[] = legs.map(leg => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: leg } }))
    if (withPoints) {
      // Ends last, so they sit on top of a loop's closing point.
      features.push(
        ...points.slice(1, -1).map(p => point(p, 'via')),
        ...queued.map(p => point(p, 'queued')),
        ...[points[0], points.length > 1 ? points.at(-1) : undefined].filter(p => !!p).map(p => point(p, 'end')),
      )
    }
    map.getSource<GeoJSONSource>(id)?.setData({ type: 'FeatureCollection', features })
  }

  function remove() {
    for (const layer of [pointsId, lineId, casingId]) {
      if (map.getLayer(layer))
        map.removeLayer(layer)
    }
    if (map.getSource(id))
      map.removeSource(id)
  }

  return { setup, update, remove }
}

function empty(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] }
}
