import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { TrailOverlayId } from '@/features/map/data/trail-overlays'
import type { Trail } from '@/features/map/domain/entities/trail'
import { TRAIL_OVERLAYS, wmtsTileUrl } from '@/features/map/data/trail-overlays'

const HIGHLIGHT_SOURCE_ID = 'trail-highlight'
const FAINT_LAYER_ID = 'trail-highlight-faint'
const CASING_LAYER_ID = 'trail-highlight-casing'
const SELECTED_LAYER_ID = 'trail-highlight-selected'
// Mirrors --orange-500 (MapLibre paint needs literal colors). Not blue: Swisstopo
// draws ski routes blue, so a blue highlight would vanish into the overlay.
const HIGHLIGHT_COLOR = '#f97316'

const layerId = (id: TrailOverlayId) => `trail-overlay-${id}`

/**
 * Trail overlays plus the lookup highlight, as one fixed stack. `setup()` must run
 * on every style load BEFORE markers and GPX: MapLibre appends in call order, so
 * everything added later sits above. Overlays are toggled by visibility, never
 * added/removed, so the stack order holds by construction.
 */
export function useTrailLayers(map: MapLibreMap) {
  function setup(active: TrailOverlayId[], card: { candidates: Trail[], selectedId: string | null } | null) {
    for (const overlay of TRAIL_OVERLAYS) {
      map.addSource(layerId(overlay.id), {
        type: 'raster',
        tiles: [wmtsTileUrl(overlay.layerBodId)],
        tileSize: 256,
        maxzoom: overlay.maxzoom,
        attribution: '© swisstopo',
      })
      map.addLayer({
        id: layerId(overlay.id),
        type: 'raster',
        source: layerId(overlay.id),
        layout: { visibility: active.includes(overlay.id) ? 'visible' : 'none' },
      })
    }

    map.addSource(HIGHLIGHT_SOURCE_ID, { type: 'geojson', data: toGeoJson(card) })
    const line = { 'line-join': 'round', 'line-cap': 'round' } as const
    map.addLayer({
      id: FAINT_LAYER_ID,
      type: 'line',
      source: HIGHLIGHT_SOURCE_ID,
      filter: ['!', ['get', 'selected']],
      layout: line,
      paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 4, 'line-opacity': 0.45 },
    })
    map.addLayer({
      id: CASING_LAYER_ID,
      type: 'line',
      source: HIGHLIGHT_SOURCE_ID,
      filter: ['get', 'selected'],
      layout: line,
      paint: { 'line-color': '#ffffff', 'line-width': 8 },
    })
    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: 'line',
      source: HIGHLIGHT_SOURCE_ID,
      filter: ['get', 'selected'],
      layout: line,
      paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 4 },
    })
  }

  function setVisible(active: TrailOverlayId[]) {
    for (const overlay of TRAIL_OVERLAYS) {
      if (map.getLayer(layerId(overlay.id)))
        map.setLayoutProperty(layerId(overlay.id), 'visibility', active.includes(overlay.id) ? 'visible' : 'none')
    }
  }

  function setHighlight(card: { candidates: Trail[], selectedId: string | null } | null) {
    map.getSource<GeoJSONSource>(HIGHLIGHT_SOURCE_ID)?.setData(toGeoJson(card))
  }

  return { setup, setVisible, setHighlight }
}

/** List view: every candidate faint. Detail view: only the chosen route, fully highlighted. */
function toGeoJson(card: { candidates: Trail[], selectedId: string | null } | null): GeoJSON.FeatureCollection {
  const shown = card?.selectedId
    ? card.candidates.filter(c => c.id === card.selectedId)
    : card?.candidates ?? []
  return {
    type: 'FeatureCollection',
    features: shown.map(trail => ({
      type: 'Feature',
      properties: { selected: trail.id === card?.selectedId },
      geometry: { type: 'MultiLineString', coordinates: trail.lines },
    })),
  }
}
