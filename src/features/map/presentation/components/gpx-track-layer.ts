import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { useLogger } from '@/core/logging/use-logger'
import { loadCachedBlob } from '@/core/offline/blob-cache'
import { useGpxCache } from '@/features/map/presentation/composables/use-gpx-cache'
import { distinctTypeColors, TOUR_TYPE_COLORS, TOUR_TYPE_TRACK_COLORS } from '@/features/tours/data/models/tour-type'
import { parseGpxFile } from '@/features/tours/data/services/gpx-parser'
import { getSignedUrl } from '@/features/tours/data/services/gpx-storage-service'
import { isSameGoal } from '@/features/tours/domain/distance'
import { outingGaps } from '@/features/tours/domain/outing'
import { DETAIL_CIRCLE_LAYER_ID, TOUR_LAYER_IDS } from './tours-marker-layer'

const GPX_SOURCE_ID = 'gpx-track'
const GPX_LAYER_ID = 'gpx-track-line'
const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const FALLBACK_TRACK_COLOR = '#555555'
/** Each colour gets this many bands along the track. */
const BAND_CYCLES = 9
/** Share of a band held solid; the rest fades into the next band's colour. */
const BAND_HOLD = 0.8

/**
 * `line-gradient` over the track's length (D8). One colour → solid. Several → `BAND_CYCLES`
 * rounds of equal bands, each holding its colour then fading smoothly into the next.
 * ponytail: bands scale with track length (progress-based); switch to distance-based bands if a
 * very long track reads badly.
 */
export function trackGradient(colors: readonly string[]): ExpressionSpecification {
  const stops: (number | string)[] = []
  if (colors.length <= 1) {
    const color = colors[0] ?? FALLBACK_TRACK_COLOR
    stops.push(0, color, 1, color)
  }
  else {
    const bands = colors.length * BAND_CYCLES
    const width = 1 / bands
    for (let i = 0; i < bands; i++) {
      const color = colors[i % colors.length]!
      stops.push(i * width, color, (i + BAND_HOLD) * width, color)
    }
    stops.push(1, colors[(bands - 1) % colors.length]!)
  }
  // `interpolate` is a fixed-arity tuple in the MapLibre types; the stop pairs are correct
  // by construction (strictly ascending inputs, colour outputs).
  return ['interpolate', ['linear'], ['line-progress'], ...stops] as unknown as ExpressionSpecification
}

const ARROW_SOURCE_ID = 'tour-connector'
const ARROW_LAYER_ID = 'tour-connector-arrow'
const CONNECTOR_WIDTH = 2
const CONNECTOR_OPACITY = 0.7
/** Screen distance between arrows along a leg; a shorter leg gets one in its middle. */
const ARROW_SPACING = 120
const GAP_SOURCE_ID = 'outing-gap'
const GAP_LAYER_ID = 'outing-gap-line'

/**
 * Dashed neutral links where an outing's segment starts away from where the previous one
 * finishes (`outingGaps`): the chain is broken — a reorder, a moved point, or a transfer.
 * `tours` is the shown list; only an outing's segments come as more than one.
 */
export function outingGapLines(tours: readonly Tour[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: 'FeatureCollection',
    features: outingGaps(tours).map(({ from, to }) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
    })),
  }
}

/** Track colour at `progress` along a line banded by `trackGradient` (held part of a band). */
function colorAt(colors: readonly string[], progress: number): string {
  if (colors.length <= 1)
    return colors[0] ?? FALLBACK_TRACK_COLOR
  const bands = colors.length * BAND_CYCLES
  return colors[Math.min(bands - 1, Math.floor(progress * bands)) % colors.length]!
}

const arrowImageId = (color: string, both: boolean) => `connector-arrow${both ? '-both' : ''}:${color}`

/**
 * Straight legs start → goal → end of a tour WITHOUT a GPX track (its track says it better),
 * banded in its activity colours like a track — the marker palette, so a segment's connector
 * matches its markers; `arrow` names the arrow image in the colour under the leg's centre.
 * ponytail: arrows repeat along a banded leg in that one colour; colour per arrow needs
 * self-placed point anchors. A round trip (end = start) is one leg with a two-way arrow; a start without
 * an end is the single leg to the goal; a leg between coinciding points is dropped.
 */
export function tourConnectors(tours: readonly Tour[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = []
  for (const tour of tours) {
    const { startPoint: start, endPoint: end, goal } = tour
    if (tour.gpxFilepath || !start)
      continue
    const center = colorAt(distinctTypeColors(tour.tourTypes, TOUR_TYPE_COLORS), 0.5)
    const leg = (a: { lng: number, lat: number }, b: { lng: number, lat: number }, both: boolean) => {
      if (!isSameGoal(a, b)) {
        features.push({
          type: 'Feature',
          properties: { arrow: arrowImageId(center, both) },
          geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
        })
      }
    }
    const roundTrip = !!end && isSameGoal(end, start)
    leg(start, goal, roundTrip)
    if (end && !roundTrip)
      leg(goal, end, false)
  }
  return { type: 'FeatureCollection', features }
}

/** A thin chevron pointing along +x (line direction); `both` adds a mirrored one, well apart. */
function drawArrow(color: string, both: boolean, pixelRatio: number): ImageData | null {
  const w = both ? 40 : 10
  const h = 10
  const canvas = document.createElement('canvas')
  canvas.width = w * pixelRatio
  canvas.height = h * pixelRatio
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  ctx.scale(pixelRatio, pixelRatio)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(w - 6, 2)
  ctx.lineTo(w - 2, 5)
  ctx.lineTo(w - 6, 8)
  if (both) {
    ctx.moveTo(6, 2)
    ctx.lineTo(2, 5)
    ctx.lineTo(6, 8)
  }
  ctx.stroke()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

const TRACK_OPACITY = 0.85

export function useGpxTrackLayer(map: MapLibreMap) {
  const logger = useLogger('GpxTrackLayer')
  const cache = useGpxCache()
  /** Track slots added to the current style (source + layer `…-<i>`); reset by a style switch. */
  let slots = 0
  /** Bumped per update: a fetch that resolves after a newer update must not draw (D16). */
  let generation = 0

  const sourceId = (i: number) => `${GPX_SOURCE_ID}-${i}`
  const layerId = (i: number) => `${GPX_LAYER_ID}-${i}`

  /** Call after every style load: the style dropped every track source and layer. */
  function setup() {
    slots = 0
  }

  function addSlot(i: number) {
    map.addSource(sourceId(i), {
      type: 'geojson',
      data: EMPTY_GEOJSON,
      // `line-progress` (the gradient's input) needs per-line distance metrics.
      lineMetrics: true,
    })
    // Sit below the start/end detail markers when present (so markers stay above
    // the track), else below the goal circle layers.
    map.addLayer(
      {
        id: layerId(i),
        type: 'line',
        source: sourceId(i),
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-gradient': trackGradient([]),
          'line-width': 3,
          'line-opacity': TRACK_OPACITY,
        },
      },
      // Under the connector arrows, which sit under the markers.
      ARROW_LAYER_ID,
    )
  }

  /** The arrow source + layer, once per style (a style switch drops them); tracks go below. */
  function ensureArrows() {
    if (map.getSource(ARROW_SOURCE_ID))
      return
    map.addSource(ARROW_SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON })
    const pixelRatio = window.devicePixelRatio || 1
    for (const color of new Set([...Object.values(TOUR_TYPE_COLORS), FALLBACK_TRACK_COLOR])) {
      for (const both of [false, true]) {
        const id = arrowImageId(color, both)
        const image = map.hasImage(id) ? null : drawArrow(color, both, pixelRatio)
        if (image)
          map.addImage(id, image, { pixelRatio })
      }
    }
    // Below the start/end detail markers when present, else below the goal circles.
    const beforeId = map.getLayer(DETAIL_CIRCLE_LAYER_ID)
      ? DETAIL_CIRCLE_LAYER_ID
      : TOUR_LAYER_IDS.find(id => map.getLayer(id))
    map.addLayer({
      id: ARROW_LAYER_ID,
      type: 'symbol',
      source: ARROW_SOURCE_ID,
      layout: {
        // Evenly spaced on screen; `line-center` would centre one per tile-clipped piece.
        'symbol-placement': 'line',
        'symbol-spacing': ARROW_SPACING,
        'icon-image': ['get', 'arrow'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': CONNECTOR_OPACITY },
    }, beforeId)
    map.addSource(GAP_SOURCE_ID, { type: 'geojson', data: EMPTY_GEOJSON })
    // Below the arrows; track slots are inserted above it (also before the arrows).
    map.addLayer({
      id: GAP_LAYER_ID,
      type: 'line',
      source: GAP_SOURCE_ID,
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': FALLBACK_TRACK_COLOR,
        'line-width': 1.5,
        'line-opacity': CONNECTOR_OPACITY,
        'line-dasharray': [2, 3],
      },
    }, ARROW_LAYER_ID)
  }

  /** Parsed track of `tour`: memory cache, else offline-first bytes (cached on first online view). */
  async function loadTrack(tour: Tour & { gpxFilepath: string }): Promise<GeoJSON.FeatureCollection | null> {
    const cached = cache.get(tour.id)
    if (cached)
      return cached
    try {
      // undefined ⇒ never cached while online and offline now → no track.
      const blob = await loadCachedBlob(tour.gpxFilepath, async () => {
        const signedUrl = await getSignedUrl(tour.gpxFilepath)
        const response = await fetch(signedUrl)
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`)
        return response.blob()
      })
      if (!blob)
        throw new Error('GPX unavailable offline')
      const file = new File([blob], `${tour.id}.gpx`, { type: 'application/gpx+xml' })
      const geojson = await parseGpxFile(file)
      cache.set(tour.id, geojson)
      return geojson
    }
    catch (err) {
      logger.error('Failed to load GPX track', err)
      return null
    }
  }

  /**
   * One slot per entry with something to draw: its GPX track, else its connector legs (same
   * activity gradient, thinner, lighter). Every other slot is emptied.
   */
  async function updateTracks(tours: Tour[]) {
    const gen = ++generation
    ensureArrows()
    map.getSource<GeoJSONSource>(ARROW_SOURCE_ID)?.setData(tourConnectors(tours))
    map.getSource<GeoJSONSource>(GAP_SOURCE_ID)?.setData(outingGapLines(tours))
    const shown = tours
      .map(tour => ({ tour, legs: tour.gpxFilepath ? null : tourConnectors([tour]) }))
      .filter(e => e.legs === null || e.legs.features.length > 0)
    while (slots < shown.length)
      addSlot(slots++)

    for (let i = shown.length; i < slots; i++)
      map.getSource<GeoJSONSource>(sourceId(i))?.setData(EMPTY_GEOJSON)

    await Promise.all(shown.map(async ({ tour, legs }, i) => {
      const source = map.getSource<GeoJSONSource>(sourceId(i))
      // Recolour BEFORE the data lands so a cached track never flashes the previous tour's colours.
      map.setPaintProperty(layerId(i), 'line-gradient', trackGradient(
        distinctTypeColors(tour.tourTypes, legs ? TOUR_TYPE_COLORS : TOUR_TYPE_TRACK_COLORS),
      ))
      map.setPaintProperty(layerId(i), 'line-width', legs ? CONNECTOR_WIDTH : 3)
      map.setPaintProperty(layerId(i), 'line-opacity', legs ? CONNECTOR_OPACITY : TRACK_OPACITY)
      if (legs) {
        source?.setData(legs)
        return
      }
      // Empty the slot while loading, so it never shows the track it held before.
      if (!cache.get(tour.id))
        source?.setData(EMPTY_GEOJSON)
      const geojson = await loadTrack(tour as Tour & { gpxFilepath: string })
      if (gen === generation)
        source?.setData(geojson ?? EMPTY_GEOJSON)
    }))
  }

  return { setup, updateTracks }
}
