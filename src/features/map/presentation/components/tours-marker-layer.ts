import type { ExpressionSpecification, LngLatLike, Map as MapLibreMap } from 'maplibre-gl'
import type { ClusterSnapshot } from './cluster-transitions'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { TOUR_TYPE_COLORS, TOUR_TYPE_PREVIEW_COLORS } from '@/features/tours/data/models/tour-type'
import { toursToGeoJson } from '@/features/tours/domain/entities/tour'
import { diffSnapshots } from './cluster-transitions'
import { createPieMarkerElement, fadeIn, fadeOut } from './pie-marker'
import { createSpiderfier } from './spiderfy'

const SOURCE_ID = 'tours'
const PREVIEW_SOURCE_ID = 'tours-preview'
export const TOUR_LAYER_IDS = ['tours-circles', 'tours-circles-selected'] as const
const LAYER_ID = TOUR_LAYER_IDS[0]
const SELECTED_LAYER_ID = TOUR_LAYER_IDS[1]
const CHECK_LAYER_ID = 'tours-completed-check'
const PREVIEW_LAYER_ID = 'tours-preview-circle'
const CHECK_ICON_ID = 'tour-check-icon'

export const CLUSTER_RADIUS = 50
export const CLUSTER_MAX_ZOOM = 14
export const CLUSTER_MIN_POINTS = 2
export const SPIDERFY_CIRCLE_RADIUS_PX = 32
export const SPIDERFY_SPIRAL_THRESHOLD = 8
export const SPIDERFY_SPIRAL_A = 28
export const SPIDERFY_SPIRAL_B = 5
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

interface ClusterPointProps { id: string, tourType: TourType | null, completed: boolean }

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

export function useToursMarkerLayer(
  map: MapLibreMap,
  onTourClick: (tourId: string) => void,
  getAriaLabel: (count: number) => string,
  getSpiderfyHint: () => string = () => 'Press Escape to collapse',
) {
  const index = new Supercluster<ClusterPointProps>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: CLUSTER_MIN_POINTS,
  })

  const clusterCache = new Map<number, ClusterEntry>()
  const staged = new Map<number, ClusterEntry>()

  const animatingIds = new Set<string>()
  const pendingClusterIds = new Set<number>()
  const tempMarkers = new Map<string, { marker: maplibregl.Marker, handle: AnimHandle }>()

  const tourDataCache = new Map<string, { lngLat: [number, number], tourType: TourType | null }>()
  const clusterCountCache = new Map<string, Record<string, number>>()

  let currentIndividualIds = new Set<string>()
  let prevZoom = 0
  let indexReady = false

  let currentSelectedId: string | null = null

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const spiderfier = createSpiderfier(map)

  function getClusterCounts(clusterId: number, total: number): Record<string, number> {
    const key = `${clusterId}:${total}`
    const cached = clusterCountCache.get(key)
    if (cached)
      return cached

    const leaves = index.getLeaves(clusterId, Infinity, 0)
    const counts: Record<string, number> = {}
    for (const leaf of leaves) {
      const type = (leaf.properties?.tourType as string | null) ?? 'unknown'
      counts[type] = (counts[type] ?? 0) + 1
    }
    clusterCountCache.set(key, counts)
    return counts
  }

  function getBboxNow(): [number, number, number, number] {
    const b = map.getBounds()
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
  }

  function snapshotAt(zoom: number): { clusters: ClusterSnapshot, individualIds: Set<string> } {
    if (!indexReady)
      return { clusters: new Map(), individualIds: new Set() }

    const features = index.getClusters(getBboxNow(), Math.floor(zoom))
    const clusters: ClusterSnapshot = new Map()
    const individualIds = new Set<string>()

    for (const f of features) {
      if (f.properties?.cluster) {
        const clusterId = f.properties.cluster_id as number
        const lngLat = f.geometry.coordinates as [number, number]
        const leafIds = index
          .getLeaves(clusterId, Infinity, 0)
          .map(l => l.properties?.id as string)
          .filter(Boolean)
        clusters.set(clusterId, { lngLat, leafIds })
      }
      else {
        const id = f.properties?.id as string | undefined
        if (id)
          individualIds.add(id)
      }
    }

    return { clusters, individualIds }
  }

  function getCurrentSnapshot(): { clusters: ClusterSnapshot, individualIds: Set<string> } {
    if (!map.getSource(SOURCE_ID))
      return { clusters: new Map(), individualIds: new Set() }
    return snapshotAt(map.getZoom())
  }

  function refreshLayerFilters() {
    if (!map.getLayer(LAYER_ID))
      return

    const visibleIds = [...currentIndividualIds].filter(id => !animatingIds.has(id))
    const inVisible: ExpressionSpecification = ['in', ['get', 'id'], ['literal', visibleIds]]

    map.setFilter(LAYER_ID, [
      'all',
      inVisible,
      ['!=', ['get', 'id'], currentSelectedId ?? ''],
    ] as ExpressionSpecification)

    map.setFilter(SELECTED_LAYER_ID, [
      'all',
      inVisible,
      ['==', ['get', 'id'], currentSelectedId ?? ''],
    ] as ExpressionSpecification)

    if (map.getLayer(CHECK_LAYER_ID)) {
      map.setFilter(CHECK_LAYER_ID, [
        'all',
        inVisible,
        ['==', ['get', 'completed'], true],
      ] as ExpressionSpecification)
    }
  }

  function attachClusterHandlers(
    element: HTMLElement,
    clusterId: number,
    lngLat: [number, number],
  ) {
    const onExpand = () => {
      const expansionZoom = index.getClusterExpansionZoom(clusterId)
      if (expansionZoom <= map.getZoom()) {
        if (spiderfier.getActiveClusterId() !== clusterId) {
          const leaves = index.getLeaves(clusterId, Infinity, 0).map(l => ({
            id: l.properties?.id as string,
            tourType: (l.properties?.tourType as TourType | null) ?? null,
          }))
          spiderfier.spiderfy(clusterId, lngLat, leaves, getSpiderfyHint(), onTourClick)
        }
      }
      else {
        spiderfier.collapse()
        map.easeTo({ center: lngLat as LngLatLike, zoom: expansionZoom })
      }
    }

    element.addEventListener('click', onExpand)
    element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onExpand()
      }
    })
  }

  function createClusterMarkerEntry(
    clusterId: number,
    lngLat: [number, number],
    leafIds: string[],
  ): ClusterEntry {
    const total = leafIds.length
    const counts = getClusterCounts(clusterId, total)
    const { element, update } = createPieMarkerElement(counts, total, TOUR_TYPE_COLORS)
    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')
    element.setAttribute('aria-label', getAriaLabel(total))

    attachClusterHandlers(element, clusterId, lngLat)

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(lngLat as LngLatLike)
      .addTo(map)

    return { marker, update }
  }

  function syncFromIndex() {
    if (!map.getSource(SOURCE_ID))
      return

    const { clusters, individualIds } = getCurrentSnapshot()
    currentIndividualIds = individualIds

    const seen = new Set<number>()
    for (const [clusterId, { lngLat, leafIds }] of clusters) {
      seen.add(clusterId)
      if (pendingClusterIds.has(clusterId))
        continue

      const total = leafIds.length
      const counts = getClusterCounts(clusterId, total)
      const existing = clusterCache.get(clusterId) ?? staged.get(clusterId)

      if (existing) {
        existing.update(counts, total)
        existing.marker.setLngLat(lngLat as LngLatLike)
        if (staged.has(clusterId)) {
          staged.delete(clusterId)
          clusterCache.set(clusterId, existing)
          fadeIn(existing.marker.getElement())
        }
      }
      else {
        const entry = createClusterMarkerEntry(clusterId, lngLat, leafIds)
        fadeIn(entry.marker.getElement())
        clusterCache.set(clusterId, entry)
      }
    }

    for (const [clusterId, entry] of clusterCache) {
      if (!seen.has(clusterId) && !pendingClusterIds.has(clusterId)) {
        clusterCache.delete(clusterId)
        const el = entry.marker.getElement()
        fadeOut(el, () => entry.marker.remove())
      }
    }

    refreshLayerFilters()
  }

  function stageAnticipatory(targetZoom: number) {
    if (!indexReady)
      return
    const predicted = snapshotAt(targetZoom).clusters

    for (const [clusterId, { lngLat, leafIds }] of predicted) {
      if (clusterCache.has(clusterId) || staged.has(clusterId))
        continue
      const entry = createClusterMarkerEntry(clusterId, lngLat, leafIds)
      staged.set(clusterId, entry)
    }
  }

  function reconcileStaged() {
    const { clusters: authSnapshot } = getCurrentSnapshot()

    for (const [clusterId, entry] of staged) {
      if (authSnapshot.has(clusterId)) {
        clusterCache.set(clusterId, entry)
        fadeIn(entry.marker.getElement())
      }
      else {
        entry.marker.remove()
      }
      staged.delete(clusterId)
    }
  }

  function cancelAllAnimations() {
    for (const { marker, handle } of tempMarkers.values()) {
      handle.cancel()
      marker.remove()
    }
    tempMarkers.clear()
    animatingIds.clear()
    pendingClusterIds.clear()
  }

  function startSplitMergeAnimations(
    fromSnapshot: ClusterSnapshot,
    fromIndividualIds: Set<string>,
    toSnapshot: ClusterSnapshot,
    toIndividualIds: Set<string>,
  ) {
    if (reducedMotion)
      return

    const { splitLeaves, mergeLeaves } = diffSnapshots(
      fromSnapshot,
      toSnapshot,
      fromIndividualIds,
      toIndividualIds,
    )

    for (const { tourId, fromClusterId } of splitLeaves) {
      const prev = fromSnapshot.get(fromClusterId)
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

    for (const { tourId, toClusterId } of mergeLeaves) {
      const newCluster = toSnapshot.get(toClusterId)
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
        syncFromIndex()
      })
      tempMarkers.set(tourId, { marker, handle })
    }

    if (splitLeaves.length > 0 || mergeLeaves.length > 0)
      refreshLayerFilters()
  }

  async function setup() {
    prevZoom = map.getZoom()

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addSource(PREVIEW_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['in', ['get', 'id'], ['literal', []]],
      paint: {
        'circle-radius': 14,
        'circle-color': COLOR_EXPR,
        'circle-opacity': 0.85,
        'circle-opacity-transition': { duration: 200 },
      },
    })

    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['in', ['get', 'id'], ['literal', []]],
      paint: {
        'circle-radius': 18,
        'circle-color': COLOR_EXPR,
        'circle-opacity': 1,
        'circle-opacity-transition': { duration: 200 },
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

    spiderfier.setup()

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
        filter: ['in', ['get', 'id'], ['literal', []]],
        layout: {
          'icon-image': CHECK_ICON_ID,
          'icon-size': 0.65,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': 1,
          'icon-opacity-transition': { duration: 200 },
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

    map.on('move', () => syncFromIndex())
    map.on('moveend', () => syncFromIndex())
    map.on('zoom', () => syncFromIndex())
    map.on('idle', () => syncFromIndex())

    map.on('movestart', () => spiderfier.collapse())

    map.on('zoomstart', () => {
      spiderfier.collapse()
      cancelAllAnimations()

      // Flush any leftover staged markers from a prior gesture
      for (const entry of staged.values())
        entry.marker.remove()
      staged.clear()

      const currentZoom = map.getZoom()
      const zoomDelta = currentZoom - prevZoom
      const targetZoom = currentZoom + Math.sign(zoomDelta !== 0 ? zoomDelta : 1)

      const fromSnap = snapshotAt(currentZoom)
      const toSnap = snapshotAt(targetZoom)

      startSplitMergeAnimations(
        fromSnap.clusters,
        fromSnap.individualIds,
        toSnap.clusters,
        toSnap.individualIds,
      )

      stageAnticipatory(targetZoom)
      prevZoom = currentZoom
    })

    map.on('zoomend', () => {
      reconcileStaged()
      syncFromIndex()
      prevZoom = map.getZoom()
    })
  }

  function updateTours(tours: Tour[], selectedTourId: string | null) {
    const source = map.getSource(SOURCE_ID)
    if (!source || source.type !== 'geojson')
      return

    tourDataCache.clear()
    clusterCountCache.clear()

    for (const tour of tours) {
      tourDataCache.set(tour.id, {
        lngLat: [tour.goal.lng, tour.goal.lat],
        tourType: tour.tourType,
      })
    }

    const geoJson = toursToGeoJson(tours)
    index.load(geoJson.features as Parameters<typeof index.load>[0])
    indexReady = true

    currentSelectedId = selectedTourId
    source.setData(geoJson)
    syncFromIndex()
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

  function cleanup() {
    spiderfier.teardown()
    cancelAllAnimations()
    for (const { marker } of clusterCache.values()) {
      marker.remove()
    }
    clusterCache.clear()
    for (const { marker } of staged.values()) {
      marker.remove()
    }
    staged.clear()
    clusterCountCache.clear()
  }

  return { setup, updateTours, updatePreview, cleanup }
}
