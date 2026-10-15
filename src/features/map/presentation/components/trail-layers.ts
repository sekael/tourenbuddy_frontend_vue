import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { TrailOverlayId } from '@/features/map/data/trail-overlays'
import type { Trail } from '@/features/map/domain/entities/trail'
import { TRAIL_OVERLAYS, wmtsTileUrl } from '@/features/map/data/trail-overlays'
import { skiDifficultyGrade } from '@/features/map/domain/ski-difficulty'
import { gradeColor, registerSkiBadges, skiBadgeId } from './ski-badge'

const CLICKABLE_SOURCE_ID = 'trail-clickable'
const CLICKABLE_HALO_LAYER_ID = 'trail-clickable-halo'
const CLICKABLE_MARKER_LAYER_ID = 'trail-clickable-marker'
const HIGHLIGHT_SOURCE_ID = 'trail-highlight'
const FAINT_LAYER_ID = 'trail-highlight-faint'
const CASING_LAYER_ID = 'trail-highlight-casing'
const SELECTED_LAYER_ID = 'trail-highlight-selected'
// Mirrors --orange-500 (MapLibre paint needs literal colors). Not blue: Swisstopo
// draws ski routes blue, so a blue highlight would vanish into the overlay.
const HIGHLIGHT_COLOR = '#f97316'

const layerId = (id: TrailOverlayId) => `trail-overlay-${id}`

interface CardState { candidates: Trail[], selectedId: string | null }

export interface TrailLayerState {
  active: TrailOverlayId[]
  /** Ski routes a tap can open (they carry route info). */
  clickable: Trail[]
  card: CardState | null
}

/**
 * Trail overlays, the clickable-route affordance and the lookup highlight, as one
 * fixed stack. `setup()` must run on every style load BEFORE markers and GPX:
 * MapLibre appends in call order, so everything added later sits above. Overlays
 * are toggled by visibility, never added/removed, so the order holds by construction.
 *
 * Stack: hiking raster → clickable halo → ski raster → highlight → difficulty badges.
 * The halo sits under the ski raster, so a clickable route reads as the same blue
 * line with a soft glow around it.
 */
export function useTrailLayers(map: MapLibreMap) {
  registerSkiBadges(map)

  function addOverlay(id: TrailOverlayId, active: TrailOverlayId[]) {
    const overlay = TRAIL_OVERLAYS.find(o => o.id === id)!
    map.addSource(layerId(id), {
      type: 'raster',
      tiles: [wmtsTileUrl(overlay.layerBodId)],
      tileSize: 256,
      maxzoom: overlay.maxzoom,
      attribution: '© swisstopo',
    })
    map.addLayer({
      id: layerId(id),
      type: 'raster',
      source: layerId(id),
      layout: { visibility: active.includes(id) ? 'visible' : 'none' },
    })
  }

  function setup({ active, clickable, card }: TrailLayerState) {
    const line = { 'line-join': 'round', 'line-cap': 'round' } as const

    addOverlay('hiking', active)
    map.addSource(CLICKABLE_SOURCE_ID, { type: 'geojson', data: clickableGeoJson(clickable) })
    map.addLayer({
      id: CLICKABLE_HALO_LAYER_ID,
      type: 'line',
      source: CLICKABLE_SOURCE_ID,
      layout: line,
      paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': 0.5, 'line-blur': 2 },
    })
    addOverlay('ski', active)

    map.addSource(HIGHLIGHT_SOURCE_ID, { type: 'geojson', data: highlightGeoJson(card) })
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
    map.addLayer({
      id: CLICKABLE_MARKER_LAYER_ID,
      type: 'symbol',
      source: CLICKABLE_SOURCE_ID,
      layout: {
        'icon-image': ['get', 'badge'],
        // Badges repeat along each route and collide like labels: routes sharing an
        // approach (several tours from one hut) show one badge there, not a stack,
        // and each route still gets badges on its own stretch. The halo marks the
        // whole line, so a dropped badge never hides a tappable route.
        'symbol-placement': 'line',
        'symbol-spacing': 220,
        'icon-rotation-alignment': 'viewport',
        'icon-padding': 4,
      },
    })
  }

  function setVisible(active: TrailOverlayId[]) {
    for (const overlay of TRAIL_OVERLAYS) {
      if (map.getLayer(layerId(overlay.id)))
        map.setLayoutProperty(layerId(overlay.id), 'visibility', active.includes(overlay.id) ? 'visible' : 'none')
    }
  }

  function setClickable(trails: Trail[]) {
    map.getSource<GeoJSONSource>(CLICKABLE_SOURCE_ID)?.setData(clickableGeoJson(trails))
  }

  function setHighlight(card: CardState | null) {
    map.getSource<GeoJSONSource>(HIGHLIGHT_SOURCE_ID)?.setData(highlightGeoJson(card))
  }

  return { setup, setVisible, setClickable, setHighlight }
}

/** Each clickable route's lines in its difficulty color, with its badge id. */
function clickableGeoJson(trails: Trail[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: trails.map((trail) => {
      const difficulty = trail.route?.difficulty ?? null
      const grade = skiDifficultyGrade(difficulty)
      const color = gradeColor(grade)
      return {
        type: 'Feature',
        properties: { color, badge: skiBadgeId(grade === null ? '' : difficulty!, color) },
        geometry: { type: 'MultiLineString', coordinates: trail.lines },
      }
    }),
  }
}

/** List view: every candidate faint. Detail view: only the chosen route, fully highlighted. */
function highlightGeoJson(card: CardState | null): GeoJSON.FeatureCollection {
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
