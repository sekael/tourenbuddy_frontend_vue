import type { ExpressionSpecification, GeoJSONSource, LngLatLike, Map as MapLibreMap } from 'maplibre-gl'
import type { ClusterSnapshot } from './cluster-transitions'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import maplibregl from 'maplibre-gl'
import { TOUR_TYPE_COLORS, TOUR_TYPE_PREVIEW_COLORS, TOUR_TYPE_VALUES } from '@/features/tours/data/models/tour-type'
import { toursToGeoJson } from '@/features/tours/domain/entities/tour'
import { diffSnapshots, snapshotClusters, snapshotClustersAsync } from './cluster-transitions'
import { createPieMarkerElement } from './pie-marker'

const SOURCE_ID = 'tours'
const PREVIEW_SOURCE_ID = 'tours-preview'
export const TOUR_LAYER_IDS = ['tours-circles', 'tours-circles-selected'] as const
const LAYER_ID = TOUR_LAYER_IDS[0]
const SELECTED_LAYER_ID = TOUR_LAYER_IDS[1]
const CHECK_LAYER_ID = 'tours-completed-check'
const PREVIEW_LAYER_ID = 'tours-preview-circle'
const CHECK_ICON_ID = 'tour-check-icon'

const CLUSTER_RADIUS = 32
const CLUSTER_MAX_ZOOM = 14
const ANIMATION_DURATION_MS = 300

function buildMatchExpr(
  colors: Record<TourType, string>,
  fallback: string,
): ExpressionSpecification {
  const pairs = Object.entries(colors).flatMap(([type, color]) => [type, color])
  return ['match', ['coalesce', ['get', 'tourType'], 'unknown'], ...pairs, fallback]
}

const COLOR_EXPR = buildMatchExpr(TOUR_TYPE_COLORS, '#78716C')
const PREVIEW_COLOR_EXPR = buildMatchExpr(TOUR_TYPE_PREVIEW_COLORS, '#A8A29E')

/** Builds clusterProperties aggregation from TourType values — one count per type + unknown bucket. */
export function buildClusterProperties(): Record<string, ExpressionSpecification> {
  const props: Record<string, ExpressionSpecification> = {}
  for (const type of TOUR_TYPE_VALUES) {
    props[type] = ['+', ['case', ['==', ['get', 'tourType'], type], 1, 0]] as ExpressionSpecification
  }
  props.unknown = ['+', ['case', ['!', ['has', 'tourType']], 1, 0]] as ExpressionSpecification
  return props
}

/** Loads a check SVG as a MapLibre icon image via addImage. Resolves true on success. */
async function loadCheckIcon(map: MapLibreMap): Promise<boolean> {
  if (map.hasImage(CHECK_ICON_ID))
    return true

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
      }
      catch {
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

function cubicEaseOut(t: number): number {
  return 1 - (1 - t) ** 3
}

interface AnimHandle { cancel: () => void }

function animateMarker(
  marker: maplibregl.Marker,
  from: [number, number],
  to: [number, number],
  durationMs: number,
  onComplete: () => void,
): AnimHandle {
  let rafId: number
  const start = performance.now()

  function frame(now: number) {
    const t = Math.min((now - start) / durationMs, 1)
    const e = cubicEaseOut(t)
    marker.setLngLat([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e])
    if (t < 1) {
      rafId = requestAnimationFrame(frame)
    }
    else {
      onComplete()
    }
  }

  rafId = requestAnimationFrame(frame)
  return { cancel: () => cancelAnimationFrame(rafId) }
}

function makeDotEl(color: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${color};opacity:0.85;pointer-events:none;`
  return el
}

interface ClusterEntry {
  marker: maplibregl.Marker
  update: (counts: Record<string, number>, total: number) => void
}

/**
 * Manages the MapLibre GL circle layers that represent tour markers,
 * including pie-chart cluster DOM markers and animated split/merge transitions.
 */
export function useToursMarkerLayer(
  map: MapLibreMap,
  onTourClick: (tourId: string) => void,
  getAriaLabel: (count: number) => string,
) {
  const clusterCache = new Map<number, ClusterEntry>()

  // Animation state
  const animatingIds = new Set<string>()
  const pendingClusterIds = new Set<number>()
  const tempMarkers = new Map<string, { marker: maplibregl.Marker, handle: AnimHandle }>()

  // Tour data cache: tourId -> { lngLat, tourType } for animation positioning and coloring
  const tourDataCache = new Map<string, { lngLat: [number, number], tourType: TourType | null }>()

  let prevSnapshot: ClusterSnapshot = new Map()
  let prevIndividualIds = new Set<string>()

  let currentSelectedId: string | null = null

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  // --- Filter builders ---

  function buildAnimExclusion(): ExpressionSpecification[] {
    if (animatingIds.size === 0)
      return []
    return [['!', ['in', ['get', 'id'], ['literal', [...animatingIds]]]]]
  }

  function refreshLayerFilters() {
    if (!map.getLayer(LAYER_ID))
      return

    const notClustered: ExpressionSpecification = ['!', ['has', 'point_count']]
    const exclusions = buildAnimExclusion()

    map.setFilter(LAYER_ID, [
      'all',
      notClustered,
      ['!=', ['get', 'id'], currentSelectedId ?? ''],
      ...exclusions,
    ] as ExpressionSpecification)

    map.setFilter(SELECTED_LAYER_ID, [
      'all',
      notClustered,
      ['==', ['get', 'id'], currentSelectedId ?? ''],
      ...exclusions,
    ] as ExpressionSpecification)

    if (map.getLayer(CHECK_LAYER_ID)) {
      map.setFilter(CHECK_LAYER_ID, [
        'all',
        notClustered,
        ['==', ['get', 'completed'], true],
        ...exclusions,
      ] as ExpressionSpecification)
    }
  }

  // --- Cluster marker sync ---

  function syncClusterMarkers() {
    if (!map.getSource(SOURCE_ID))
      return

    const features = map.querySourceFeatures(SOURCE_ID, {
      filter: ['has', 'point_count'],
    })

    const seen = new Set<number>()
    for (const feature of features) {
      const clusterId = feature.properties?.cluster_id as number | undefined
      if (clusterId == null)
        continue
      seen.add(clusterId)
      if (pendingClusterIds.has(clusterId))
        continue

      const lngLat = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
      const total = (feature.properties?.point_count ?? 0) as number
      const counts: Record<string, number> = {}
      for (const type of TOUR_TYPE_VALUES) {
        counts[type] = (feature.properties?.[type] ?? 0) as number
      }
      counts.unknown = (feature.properties?.unknown ?? 0) as number

      const existing = clusterCache.get(clusterId)
      if (existing) {
        existing.update(counts, total)
        existing.marker.setLngLat(lngLat as LngLatLike)
      }
      else {
        const { element, update } = createPieMarkerElement(counts, total, TOUR_TYPE_COLORS)
        element.setAttribute('role', 'button')
        element.setAttribute('tabindex', '0')
        element.setAttribute('aria-label', getAriaLabel(total))

        const onExpand = () => {
          const geoSource = map.getSource(SOURCE_ID) as GeoJSONSource
          geoSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null)
              return
            map.easeTo({ center: lngLat as LngLatLike, zoom })
          })
        }

        element.addEventListener('click', onExpand)
        element.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ')
            onExpand()
        })

        const marker = new maplibregl.Marker({ element, anchor: 'center' })
          .setLngLat(lngLat as LngLatLike)
          .addTo(map)
        clusterCache.set(clusterId, { marker, update })
      }
    }

    for (const [clusterId, entry] of clusterCache) {
      if (!seen.has(clusterId)) {
        entry.marker.remove()
        clusterCache.delete(clusterId)
      }
    }
  }

  // --- Animation ---

  function cancelAllAnimations() {
    for (const { marker, handle } of tempMarkers.values()) {
      handle.cancel()
      marker.remove()
    }
    tempMarkers.clear()
    animatingIds.clear()
    pendingClusterIds.clear()
  }

  async function runTransitions() {
    if (reducedMotion)
      return

    const newSnapshot = await snapshotClustersAsync(map, SOURCE_ID)

    const individualFeatures = map.querySourceFeatures(SOURCE_ID, {
      filter: ['!', ['has', 'point_count']],
    })
    const newIndividualIds = new Set(
      individualFeatures.map(f => f.properties?.id as string).filter(Boolean),
    )

    const { splitLeaves, mergeLeaves } = diffSnapshots(
      prevSnapshot,
      newSnapshot,
      prevIndividualIds,
      newIndividualIds,
    )

    // Animate split leaves (cluster → individual)
    for (const { tourId, fromClusterId } of splitLeaves) {
      const prev = prevSnapshot.get(fromClusterId)
      const tourData = tourDataCache.get(tourId)
      if (!prev || !tourData)
        continue

      const fromLngLat = prev.lngLat
      const toLngLat = tourData.lngLat
      const color = tourData.tourType ? (TOUR_TYPE_COLORS[tourData.tourType] ?? '#78716C') : '#78716C'

      animatingIds.add(tourId)
      const el = makeDotEl(color)
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(fromLngLat as LngLatLike)
        .addTo(map)

      const handle = animateMarker(marker, fromLngLat, toLngLat, ANIMATION_DURATION_MS, () => {
        marker.remove()
        animatingIds.delete(tourId)
        tempMarkers.delete(tourId)
        refreshLayerFilters()
      })
      tempMarkers.set(tourId, { marker, handle })
    }

    // Animate merge leaves (individual → cluster)
    for (const { tourId, toClusterId } of mergeLeaves) {
      const newCluster = newSnapshot.get(toClusterId)
      const tourData = tourDataCache.get(tourId)
      if (!newCluster || !tourData)
        continue

      const fromLngLat = tourData.lngLat
      const toLngLat = newCluster.lngLat
      const color = tourData.tourType ? (TOUR_TYPE_COLORS[tourData.tourType] ?? '#78716C') : '#78716C'

      animatingIds.add(tourId)
      pendingClusterIds.add(toClusterId)

      const el = makeDotEl(color)
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(fromLngLat as LngLatLike)
        .addTo(map)

      const handle = animateMarker(marker, fromLngLat, toLngLat, ANIMATION_DURATION_MS, () => {
        marker.remove()
        animatingIds.delete(tourId)
        tempMarkers.delete(tourId)
        pendingClusterIds.delete(toClusterId)
        refreshLayerFilters()
        syncClusterMarkers()
      })
      tempMarkers.set(tourId, { marker, handle })
    }

    if (splitLeaves.length > 0 || mergeLeaves.length > 0) {
      refreshLayerFilters()
    }

    prevSnapshot = newSnapshot
    prevIndividualIds = newIndividualIds
  }

  // --- Setup ---

  async function setup() {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS,
      clusterProperties: buildClusterProperties() as Record<string, ExpressionSpecification>,
    })

    map.addSource(PREVIEW_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    const notClustered: ExpressionSpecification = ['!', ['has', 'point_count']]

    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['all', notClustered, ['!=', ['get', 'id'], '']],
      paint: {
        'circle-radius': 14,
        'circle-color': COLOR_EXPR,
        'circle-opacity': 0.85,
      },
    })

    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['all', notClustered, ['==', ['get', 'id'], '']],
      paint: {
        'circle-radius': 18,
        'circle-color': COLOR_EXPR,
        'circle-opacity': 1,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

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

    const iconLoaded = await loadCheckIcon(map)
    if (iconLoaded) {
      map.addLayer({
        id: CHECK_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['all', notClustered, ['==', ['get', 'completed'], true]],
        layout: {
          'icon-image': CHECK_ICON_ID,
          'icon-size': 0.65,
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

    map.on('data', () => syncClusterMarkers())
    map.on('moveend', () => syncClusterMarkers())

    map.on('zoomstart', () => {
      cancelAllAnimations()
      refreshLayerFilters()
      prevSnapshot = snapshotClusters(map, SOURCE_ID)
    })

    map.on('zoomend', () => {
      runTransitions().then(() => syncClusterMarkers()).catch(() => syncClusterMarkers())
    })
  }

  // --- Public API ---

  function updateTours(tours: Tour[], selectedTourId: string | null) {
    const source = map.getSource(SOURCE_ID)
    if (!source || source.type !== 'geojson')
      return

    // Refresh tour data cache for animation
    tourDataCache.clear()
    for (const tour of tours) {
      tourDataCache.set(tour.id, {
        lngLat: [tour.goal.lng, tour.goal.lat],
        tourType: tour.tourType,
      })
    }

    currentSelectedId = selectedTourId
    source.setData(toursToGeoJson(tours))
    refreshLayerFilters()
  }

  function updatePreview(goal: { lng: number, lat: number } | null, tourType: TourType | null) {
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
              properties: { tourType: tourType ?? null },
            },
          ]
        : [],
    })
  }

  /** Removes all cluster DOM markers and cancels animations. Call before style reload and on unmount. */
  function cleanup() {
    cancelAllAnimations()
    for (const { marker } of clusterCache.values()) {
      marker.remove()
    }
    clusterCache.clear()
  }

  return { setup, updateTours, updatePreview, cleanup }
}
