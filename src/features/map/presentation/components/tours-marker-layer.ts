import type { ExpressionSpecification, LngLatLike, Map as MapLibreMap } from 'maplibre-gl'
import type { RenderedNode } from './cluster-transitions'
import type { InternalNode, TreeNode } from './cluster-tree'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import maplibregl from 'maplibre-gl'
import { TOUR_TYPE_COLORS, TOUR_TYPE_PREVIEW_COLORS } from '@/features/tours/data/models/tour-type'
import { toursToGeoJson } from '@/features/tours/domain/entities/tour'
import { diffForests } from './cluster-transitions'
import {
  buildClusterTree,
  buildParentMap,
  CLUSTER_RADIUS,
  collectSplitZooms,
  cutForest,
  findCrossings,
} from './cluster-tree'
import { createPieMarkerElement, fadeIn, fadeOut } from './pie-marker'
import { createSpiderfier } from './spiderfy'

export { CLUSTER_RADIUS }

const SOURCE_ID = 'tours'
const PREVIEW_SOURCE_ID = 'tours-preview'
export const TOUR_LAYER_IDS = ['tours-circles', 'tours-circles-selected'] as const
const LAYER_ID = TOUR_LAYER_IDS[0]
const SELECTED_LAYER_ID = TOUR_LAYER_IDS[1]
const CHECK_LAYER_ID = 'tours-completed-check'
const FRIEND_LAYER_ID = 'tours-friend-indicator'
const PREVIEW_LAYER_ID = 'tours-preview-circle'
const CHECK_ICON_ID = 'tour-check-icon'
const FRIEND_ICON_ID = 'tour-friend-icon'

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

async function loadFriendIcon(map: MapLibreMap): Promise<boolean> {
  if (map.hasImage(FRIEND_ICON_ID))
    return true

  const size = 28
  // Two-person glyph in white — marks a friend's tour inside the marker.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28" fill="white">
      <circle cx="10" cy="9" r="3.5" />
      <path d="M4 21c0-3.3 2.7-6 6-6s6 2.7 6 6z" />
      <circle cx="19" cy="10" r="3" />
      <path d="M19 14c2.8 0 5 2.2 5 5h-6.2c.2-.6.2-1.2.2-1.8 0-1.2-.3-2.3-.8-3.2z" />
    </svg>
  `.trim()

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image(size, size)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        map.addImage(FRIEND_ICON_ID, img, { sdf: false })
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
  setNode: (node: InternalNode) => void
}

export function useToursMarkerLayer(
  map: MapLibreMap,
  onTourClick: (tourId: string) => void,
  getAriaLabel: (count: number) => string,
  getSpiderfyHint: () => string = () => 'Press Escape to collapse',
) {
  const clusterCache = new Map<string, ClusterEntry>()
  const animatingIds = new Set<string>()
  const inflight: Array<{ handle: AnimHandle, marker: maplibregl.Marker }> = []

  const tourDataCache = new Map<string, { lngLat: [number, number], tourType: TourType | null }>()

  let currentTree: TreeNode | null = null
  let splitZooms: number[] = []
  let lastSampledZoom = 0
  let currentIndividualIds = new Set<string>()
  let currentSelectedId: string | null = null
  let lastFrame: { tree: TreeNode | null, zoom: number, byNodeId: Map<string, RenderedNode> } = {
    tree: null,
    zoom: 0,
    byNodeId: new Map(),
  }

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const spiderfier = createSpiderfier(map)

  function getBboxNow(): [number, number, number, number] {
    const b = map.getBounds()
    return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
  }

  function getCountsForNode(node: InternalNode): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const id of node.leafIds) {
      const data = tourDataCache.get(id)
      const type = String(data?.tourType ?? 'unknown')
      counts[type] = (counts[type] ?? 0) + 1
    }
    return counts
  }

  function makePieTempEl(leafIds: string[]): HTMLElement {
    const counts: Record<string, number> = {}
    let total = 0
    for (const id of leafIds) {
      const data = tourDataCache.get(id)
      const type = String(data?.tourType ?? 'unknown')
      counts[type] = (counts[type] ?? 0) + 1
      total++
    }
    const { element } = createPieMarkerElement(counts, total, TOUR_TYPE_COLORS)
    element.style.cssText = 'cursor:default;opacity:1;transition:none;pointer-events:none;'
    return element
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

    if (map.getLayer(FRIEND_LAYER_ID)) {
      map.setFilter(FRIEND_LAYER_ID, [
        'all',
        inVisible,
        ['==', ['get', 'isFriendTour'], true],
      ] as ExpressionSpecification)
    }
  }

  function spawnTemp(
    element: HTMLElement,
    from: [number, number],
    to: [number, number],
    onComplete: () => void,
  ) {
    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(from as LngLatLike)
      .addTo(map)
    const entry = { handle: { cancel: () => {} } as AnimHandle, marker }
    const handle = animateMarker(marker, from, to, ANIMATION_DURATION_MS, () => {
      const idx = inflight.indexOf(entry)
      if (idx >= 0)
        inflight.splice(idx, 1)
      marker.remove()
      onComplete()
    })
    entry.handle = handle
    inflight.push(entry)
  }

  function cancelAllAnimations() {
    for (const { handle, marker } of inflight) {
      handle.cancel()
      marker.remove()
    }
    inflight.length = 0
    animatingIds.clear()
  }

  function classifyAppeared(
    node: TreeNode,
    oldByNodeId: Map<string, RenderedNode>,
    parentMap: Map<string, string>,
  ): { kind: 'split-from', sourceCentroid: [number, number] } | { kind: 'created' } {
    let currentId = node.id
    while (true) {
      const parentId = parentMap.get(currentId)
      if (!parentId)
        break
      const oldParent = oldByNodeId.get(parentId)
      if (oldParent)
        return { kind: 'split-from', sourceCentroid: oldParent.centroid }
      currentId = parentId
    }
    return { kind: 'created' }
  }

  function classifyDisappeared(
    node: RenderedNode,
    newByNodeId: Map<string, RenderedNode>,
  ): { kind: 'merged-into', targetCentroid: [number, number] } | { kind: 'split' } | { kind: 'deleted' } {
    for (const newNode of newByNodeId.values()) {
      if (newNode.id === node.id)
        continue
      const newLeafSet = new Set(newNode.leafIds)
      if (node.leafIds.every(id => newLeafSet.has(id)))
        return { kind: 'merged-into', targetCentroid: newNode.centroid }
    }
    // Split: leafIds spread across 2+ new nodes
    const containers = new Set<string>()
    const leafSet = new Set(node.leafIds)
    for (const newNode of newByNodeId.values()) {
      if (newNode.leafIds.some(id => leafSet.has(id)))
        containers.add(newNode.id)
    }
    if (containers.size >= 2)
      return { kind: 'split' }
    return { kind: 'deleted' }
  }

  function createClusterMarkerEntry(node: InternalNode): ClusterEntry {
    let currentNode = node
    const counts = getCountsForNode(node)
    const { element, update } = createPieMarkerElement(counts, node.totalLeafCount, TOUR_TYPE_COLORS)
    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')
    element.setAttribute('aria-label', getAriaLabel(node.totalLeafCount))

    const onExpand = () => {
      if (currentNode.splitZoom > map.getMaxZoom()) {
        if (spiderfier.getActiveClusterId() !== currentNode.id) {
          const leaves = currentNode.leafIds.map(id => ({
            id,
            tourType: tourDataCache.get(id)?.tourType ?? null,
          }))
          spiderfier.spiderfy(currentNode.id, currentNode.centroid, leaves, getSpiderfyHint(), onTourClick)
        }
      }
      else {
        spiderfier.collapse()
        map.easeTo({ center: currentNode.centroid as LngLatLike, zoom: currentNode.splitZoom + 0.01 })
      }
    }

    element.addEventListener('click', onExpand)
    element.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onExpand()
      }
    })

    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(node.centroid as LngLatLike)
      .addTo(map)

    function setNode(n: InternalNode) {
      currentNode = n
    }
    return { marker, update, setNode }
  }

  function commitFrame(newTree: TreeNode | null, newZoom: number) {
    if (!map.getSource(SOURCE_ID))
      return

    const bbox = getBboxNow()
    const forest = cutForest(newTree, newZoom, bbox)

    const newByNodeId = new Map<string, RenderedNode>()
    const newTreeById = new Map<string, TreeNode>()
    for (const node of forest) {
      const centroid = node.kind === 'leaf' ? node.coord : node.centroid
      const leafIds = node.kind === 'leaf' ? [node.id] : node.leafIds
      newByNodeId.set(node.id, { id: node.id, kind: node.kind, centroid, leafIds })
      newTreeById.set(node.id, node)
    }

    const { byNodeId: oldByNodeId } = lastFrame
    const { appeared, disappeared, updated } = diffForests(oldByNodeId, forest)
    const parentMap = buildParentMap(newTree)

    // Update visible leaf set before filter refresh
    currentIndividualIds = new Set(
      forest.filter(n => n.kind === 'leaf').map(n => n.id),
    )

    for (const node of disappeared) {
      const clusterEntry = clusterCache.get(node.id)
      clusterCache.delete(node.id)
      const classification = classifyDisappeared(node, newByNodeId)

      if (classification.kind === 'merged-into') {
        if (reducedMotion) {
          clusterEntry?.marker.remove()
        }
        else if (node.kind === 'leaf') {
          const tourData = tourDataCache.get(node.id)
          if (tourData) {
            animatingIds.add(node.id)
            const color = tourData.tourType ? (TOUR_TYPE_COLORS[tourData.tourType] ?? '#78716C') : '#78716C'
            spawnTemp(makeDotEl(color), node.centroid, classification.targetCentroid, () => {
              animatingIds.delete(node.id)
              refreshLayerFilters()
            })
          }
        }
        else {
          clusterEntry?.marker.remove()
          spawnTemp(
            makePieTempEl(node.leafIds),
            node.centroid,
            classification.targetCentroid,
            () => {},
          )
        }
      }
      else if (classification.kind === 'split') {
        // Remove parent instantly so children fan-out is the only visible motion
        clusterEntry?.marker.remove()
      }
      else {
        // deleted
        if (clusterEntry) {
          if (reducedMotion) {
            clusterEntry.marker.remove()
          }
          else {
            fadeOut(clusterEntry.marker.getElement(), () => clusterEntry.marker.remove())
          }
        }
        // leaves just drop out of currentIndividualIds; GL filter handles visibility
      }
    }

    for (const node of appeared) {
      const treeNode = newTreeById.get(node.id)
      if (!treeNode)
        continue
      const classification = classifyAppeared(treeNode, oldByNodeId, parentMap)

      if (treeNode.kind === 'internal') {
        const entry = createClusterMarkerEntry(treeNode)
        clusterCache.set(node.id, entry)

        if (!reducedMotion && classification.kind === 'split-from') {
          spawnTemp(makePieTempEl(treeNode.leafIds), classification.sourceCentroid, treeNode.centroid, () => {
            fadeIn(entry.marker.getElement())
          })
        }
        else {
          fadeIn(entry.marker.getElement())
        }
      }
      else {
        // leaf
        if (!reducedMotion && classification.kind === 'split-from') {
          const tourData = tourDataCache.get(node.id)
          if (tourData) {
            animatingIds.add(node.id)
            const color = tourData.tourType ? (TOUR_TYPE_COLORS[tourData.tourType] ?? '#78716C') : '#78716C'
            spawnTemp(makeDotEl(color), classification.sourceCentroid, treeNode.coord, () => {
              animatingIds.delete(node.id)
              refreshLayerFilters()
            })
          }
        }
      }
    }

    for (const node of updated) {
      const treeNode = newTreeById.get(node.id)
      if (!treeNode || treeNode.kind !== 'internal')
        continue
      const entry = clusterCache.get(node.id)
      if (!entry)
        continue

      const oldNode = oldByNodeId.get(node.id)!
      entry.setNode(treeNode)
      const centroidChanged
        = oldNode.centroid[0] !== treeNode.centroid[0]
          || oldNode.centroid[1] !== treeNode.centroid[1]
      const leafCountChanged = oldNode.leafIds.length !== treeNode.leafIds.length

      if (centroidChanged) {
        if (reducedMotion) {
          entry.marker.setLngLat(treeNode.centroid as LngLatLike)
        }
        else {
          animateMarker(entry.marker, oldNode.centroid, treeNode.centroid, ANIMATION_DURATION_MS, () => {})
        }
      }

      if (leafCountChanged) {
        const counts = getCountsForNode(treeNode)
        entry.update(counts, treeNode.totalLeafCount)
        entry.marker.getElement().setAttribute('aria-label', getAriaLabel(treeNode.totalLeafCount))
      }
    }

    refreshLayerFilters()
    lastFrame = { tree: newTree, zoom: newZoom, byNodeId: newByNodeId }
  }

  async function setup() {
    lastSampledZoom = map.getZoom()

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

    const friendIconLoaded = await loadFriendIcon(map)
    if (friendIconLoaded) {
      // Friendship indicator sits at the lower part of the marker so it does not
      // collide with the completion check (centered) on completed friend tours.
      map.addLayer({
        id: FRIEND_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['in', ['get', 'id'], ['literal', []]],
        layout: {
          'icon-image': FRIEND_ICON_ID,
          'icon-size': 0.5,
          'icon-offset': [0, 12],
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

    map.on('move', () => commitFrame(currentTree, map.getZoom()))
    map.on('moveend', () => commitFrame(currentTree, map.getZoom()))
    map.on('zoom', () => {
      const newZoom = map.getZoom()
      const crossings = findCrossings(splitZooms, lastSampledZoom, newZoom)
      if (crossings.length > 0)
        commitFrame(currentTree, newZoom)
      lastSampledZoom = newZoom
    })
    map.on('idle', () => commitFrame(currentTree, map.getZoom()))

    map.on('movestart', () => spiderfier.collapse())

    map.on('zoomstart', () => {
      spiderfier.collapse()
      cancelAllAnimations()
      lastSampledZoom = map.getZoom()
    })

    map.on('zoomend', () => {
      const newZoom = map.getZoom()
      commitFrame(currentTree, newZoom)
      lastSampledZoom = newZoom
    })
  }

  function updateTours(tours: Tour[], selectedTourId: string | null) {
    const source = map.getSource(SOURCE_ID)
    if (!source || source.type !== 'geojson')
      return

    cancelAllAnimations()

    tourDataCache.clear()
    for (const tour of tours) {
      tourDataCache.set(tour.id, {
        lngLat: [tour.goal.lng, tour.goal.lat],
        tourType: tour.tourType,
      })
    }

    currentTree = buildClusterTree(tours)
    splitZooms = collectSplitZooms(currentTree)
    currentSelectedId = selectedTourId

    const geoJson = toursToGeoJson(tours)
    source.setData(geoJson)
    commitFrame(currentTree, map.getZoom())
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
    currentTree = null
    lastFrame = { tree: null, zoom: 0, byNodeId: new Map() }
    splitZooms = []
  }

  return { setup, updateTours, updatePreview, cleanup }
}
