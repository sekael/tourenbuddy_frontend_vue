import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Tour } from '@/features/tours/domain/entities/tour'
import { useLogger } from '@/core/logging/use-logger'
import { loadCachedBlob } from '@/core/offline/blob-cache'
import { useGpxCache } from '@/features/map/presentation/composables/use-gpx-cache'
import { distinctTypeColors, TOUR_TYPE_TRACK_COLORS } from '@/features/tours/data/models/tour-type'
import { parseGpxFile } from '@/features/tours/data/services/gpx-parser'
import { getSignedUrl } from '@/features/tours/data/services/gpx-storage-service'
import { DETAIL_CIRCLE_LAYER_ID, TOUR_LAYER_IDS } from './tours-marker-layer'

const GPX_SOURCE_ID = 'gpx-track'
const GPX_LAYER_ID = 'gpx-track-line'
const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const FALLBACK_TRACK_COLOR = '#555555'
/** Each colour gets this many bands along the track. */
const BAND_CYCLES = 3
/** Share of a band held solid; the rest fades into the next band's colour. */
const BAND_HOLD = 0.6

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

/** One track to draw; `dimmed` = an outing's other segment while one segment is open (D16). */
export interface TrackEntry {
  tour: Tour
  dimmed: boolean
}

const TRACK_OPACITY = 0.85
const DIMMED_TRACK_OPACITY = 0.4

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
    const beforeId = map.getLayer(DETAIL_CIRCLE_LAYER_ID)
      ? DETAIL_CIRCLE_LAYER_ID
      : TOUR_LAYER_IDS.find(id => map.getLayer(id))
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
      beforeId,
    )
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

  /** Draw exactly `entries`' tracks (those with a GPX file); every other slot is emptied. */
  async function updateTracks(entries: TrackEntry[]) {
    const gen = ++generation
    const tracks = entries.filter((e): e is TrackEntry & { tour: { gpxFilepath: string } } => !!e.tour.gpxFilepath)
    while (slots < tracks.length)
      addSlot(slots++)

    for (let i = tracks.length; i < slots; i++)
      map.getSource<GeoJSONSource>(sourceId(i))?.setData(EMPTY_GEOJSON)

    await Promise.all(tracks.map(async ({ tour, dimmed }, i) => {
      const source = map.getSource<GeoJSONSource>(sourceId(i))
      // Recolour BEFORE the data lands so a cached track never flashes the previous tour's colours.
      map.setPaintProperty(layerId(i), 'line-gradient', trackGradient(
        distinctTypeColors(tour.tourTypes, TOUR_TYPE_TRACK_COLORS),
      ))
      map.setPaintProperty(layerId(i), 'line-opacity', dimmed ? DIMMED_TRACK_OPACITY : TRACK_OPACITY)
      // Empty the slot while loading, so it never shows the track it held before.
      if (!cache.get(tour.id))
        source?.setData(EMPTY_GEOJSON)
      const geojson = await loadTrack(tour)
      if (gen === generation)
        source?.setData(geojson ?? EMPTY_GEOJSON)
    }))
  }

  return { setup, updateTracks }
}
