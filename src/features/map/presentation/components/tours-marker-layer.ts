import type { ExpressionSpecification, GeoJSONSource, LngLatLike, Map as MapLibreMap } from 'maplibre-gl'
import type { RenderedNode } from './cluster-transitions'
import type { InternalNode, TreeNode } from './cluster-tree'
import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'
import type { DetailMarker } from '@/features/tours/domain/tour-detail-markers'
import maplibregl from 'maplibre-gl'
import { TOUR_TYPE_COLORS, TOUR_TYPE_PREVIEW_COLORS } from '@/features/tours/data/models/tour-type'
import { toursToGeoJson } from '@/features/tours/domain/entities/tour'
import { routeOrder } from '@/features/tours/domain/legs'
import { diffForests } from './cluster-transitions'
import {
  buildClusterTree,
  buildParentMap,
  CLUSTER_RADIUS,
  collectSplitZooms,
  cutForest,
  findCrossings,
} from './cluster-tree'
import {
  addTourWeight,
  createPieMarkerElement,
  cssFill,
  drawPieImage,
  drawSegmentBadge,
  fadeIn,
  fadeOut,
  FALLBACK_COLOR,
  MARKER_RADIUS,
  pieImageColors,
  pieImageId,
  segmentBadgeId,
  segmentBadgeNumber,
  tourColors,
} from './pie-marker'
import { createSpiderfier } from './spiderfy'

export { CLUSTER_RADIUS }

const SOURCE_ID = 'tours'
const PREVIEW_SOURCE_ID = 'tours-preview'
export const TOUR_LAYER_IDS = ['tours-circles', 'tours-circles-selected'] as const
const LAYER_ID = TOUR_LAYER_IDS[0]
const SELECTED_LAYER_ID = TOUR_LAYER_IDS[1]
const CHECK_LAYER_ID = 'tours-completed-check'
const FRIEND_LAYER_ID = 'tours-friend-indicator'
const LINK_LAYER_ID = 'tours-link-indicator'
const PREVIEW_LAYER_ID = 'tours-preview-circle'
// Split (multi-colour) fills drawn over a transparent circle, one per circle layer (D6).
const SPLIT_LAYER_ID = 'tours-split'
const SELECTED_SPLIT_LAYER_ID = 'tours-split-selected'
const DETAIL_SPLIT_LAYER_ID = 'tour-detail-split'
const PREVIEW_SPLIT_LAYER_ID = 'tours-preview-split'
// Number badges on the focused outing's segments (design D16).
const SEGMENT_BADGE_LAYER_ID = 'tours-segment-badge'
const CHECK_ICON_ID = 'tour-check-icon'
const FRIEND_ICON_ID = 'tour-friend-icon'
const LINK_ICON_ID = 'tour-link-icon'

// Selection-scoped start/end detail markers — own source so they never touch
// clustering/collision; rendered beneath the goal so the goal stays on top.
const DETAIL_SOURCE_ID = 'tour-detail'
export const DETAIL_CIRCLE_LAYER_ID = 'tour-detail-circle'
const DETAIL_ICON_LAYER_ID = 'tour-detail-icon'
const START_ICON_ID = 'tour-start-icon'
const END_ICON_ID = 'tour-end-icon'

// Shared with the goal circle so the detail circle can't visually drift from it.
const MARKER_CIRCLE_RADIUS = 14
/** A handover ring (D21): small enough to read as a waypoint, not a destination. */
const VIA_CIRCLE_RADIUS = 6
const SELECTED_CIRCLE_RADIUS = 18
const PREVIEW_CIRCLE_RADIUS = 16
const MARKER_CIRCLE_OPACITY = 0.85

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
  // `match` is a fixed-arity tuple in the MapLibre types; a runtime-length spread of
  // label/value pairs cannot satisfy it structurally, though the shape is correct.
  return ['match', ['coalesce', ['get', 'tourType'], 'unknown'], ...pairs, fallback] as unknown as ExpressionSpecification
}

const COLOR_EXPR = buildMatchExpr(TOUR_TYPE_COLORS, '#78716C')
const PREVIEW_COLOR_EXPR = buildMatchExpr(TOUR_TYPE_PREVIEW_COLORS, '#A8A29E')

// A feature with a `pieImage` is split: its circle keeps radius, stroke and hit area but turns
// transparent, and the split layer above paints the slices (design D6).
const IS_SPLIT: ExpressionSpecification = ['to-boolean', ['get', 'pieImage']]
const TRANSPARENT = 'rgba(0,0,0,0)'
function unlessSplit(color: ExpressionSpecification): ExpressionSpecification {
  return ['case', IS_SPLIT, TRANSPARENT, color]
}

/** Symbol layer painting the split fill of a circle layer's features at that circle's `radius`. */
function addSplitLayer(
  map: MapLibreMap,
  id: string,
  source: string,
  radius: number,
  opacity: number,
  beforeId?: string,
) {
  map.addLayer({
    id,
    type: 'symbol',
    source,
    filter: IS_SPLIT,
    layout: {
      'icon-image': ['get', 'pieImage'],
      // Images are drawn at MARKER_RADIUS (the largest circle) and scaled down.
      'icon-size': radius / MARKER_RADIUS,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': opacity },
  }, beforeId)
}

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

  // Logical (CSS-px) size of the icon; the 0..28 viewBox holds the glyph geometry.
  const size = 28
  // Rasterize at 4× and register with a matching pixelRatio so the texture carries
  // 4× the detail while still measuring 28 logical px — crisp on hi-DPI / when scaled.
  const scale = 4
  const render = size * scale
  // Two-person glyph — marks a friend's tour inside the marker.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${render}" height="${render}" viewBox="0 0 28 28" fill="white">
      <circle cx="10" cy="9" r="3.5" />
      <path d="M4 21c0-3.3 2.7-6 6-6s6 2.7 6 6z" />
      <circle cx="19" cy="10" r="3" />
      <path d="M19 14c2.8 0 5 2.2 5 5h-6.2c.2-.6.2-1.2.2-1.8 0-1.2-.3-2.3-.8-3.2z" />
    </svg>
  `.trim()

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image(render, render)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        // SDF so the layer can tint it per tour type via `icon-color`; the SVG's
        // own white fill is ignored — only its alpha silhouette is used.
        map.addImage(FRIEND_ICON_ID, img, { sdf: true, pixelRatio: scale })
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

async function loadLinkIcon(map: MapLibreMap): Promise<boolean> {
  if (map.hasImage(LINK_ICON_ID))
    return true

  const size = 28
  const scale = 4
  const render = size * scale
  // Chain-link glyph (two interlocking links) — marks a tour that belongs to a
  // tour_link_group. White fill; the SDF alpha silhouette is tinted by the layer.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${render}" height="${render}" viewBox="0 0 28 28" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.5 16.5l-3 3a3.5 3.5 0 1 1-4.95-4.95l3-3a3.5 3.5 0 0 1 4.95 0" />
      <path d="M16.5 11.5l3-3a3.5 3.5 0 1 1 4.95 4.95l-3 3a3.5 3.5 0 0 1-4.95 0" />
      <path d="M10.5 17.5l7-7" />
    </svg>
  `.trim()

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image(render, render)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        map.addImage(LINK_ICON_ID, img, { sdf: true, pixelRatio: scale })
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

// Rasterizes a white glyph (non-SDF, like the completion check) at 4× for crisp
// hi-DPI rendering. Used for the start/end detail-marker icons.
async function loadWhiteGlyphIcon(map: MapLibreMap, id: string, innerSvg: string): Promise<boolean> {
  if (map.hasImage(id))
    return true

  const size = 24
  const scale = 4
  const render = size * scale
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${render}" height="${render}" viewBox="0 0 24 24" fill="white">
      ${innerSvg}
    </svg>
  `.trim()

  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image(render, render)
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        map.addImage(id, img, { sdf: false, pixelRatio: scale })
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

// Ring glyph (start) and chequered flag (end) — the form's and the detail rows' `trip_origin` /
// `sports_score` (design D22). A house would read as a hut on swisstopo maps.
const START_GLYPH_SVG = '<path d="M8.125 21.213q-1.825-.788-3.187-2.15t-2.15-3.188T2 11.988t.788-3.875t2.15-3.175t3.187-2.15T12.013 2t3.875.788t3.175 2.15t2.15 3.175t.787 3.875t-.787 3.887t-2.15 3.188t-3.175 2.15t-3.875.787t-3.888-.787m8.125-4.963Q18 14.5 18 12t-1.75-4.25T12 6T7.75 7.75T6 12t1.75 4.25T12 18t4.25-1.75" />'
const END_GLYPH_SVG = '<path d="M9 6h2V4H9zm4 0V4h2v2zm-4 8v-2h2v2zm8-4V8h2v2zm0 4v-2h2v2zm-4 0v-2h2v2zm4-8V4h2v2zm-6 2V6h2v2zM5 20V4h2v2h2v2H7v2h2v2H7v8zm10-8v-2h2v2zm-4 0v-2h2v2zm-2-2V8h2v2zm4 0V8h2v2zm2-2V6h2v2z" />'

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

function makeDotEl(colors: string[]): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = `width:12px;height:12px;border-radius:50%;background:${cssFill(colors)};opacity:0.85;pointer-events:none;`
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

  const tourDataCache = new Map<string, { lngLat: [number, number], colors: string[] }>()
  let pieImagesHandled = false

  let currentTree: TreeNode | null = null
  let splitZooms: number[] = []
  let lastSampledZoom = 0
  let currentIndividualIds = new Set<string>()
  let currentSelectedId: string | null = null
  /** The focused outing's segments: kept out of clustering so every one shows (D16). */
  let pinnedIds = new Set<string>()
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
    for (const id of node.leafIds)
      addTourWeight(counts, tourDataCache.get(id)?.colors ?? [FALLBACK_COLOR])
    return counts
  }

  function makePieTempEl(leafIds: string[]): HTMLElement {
    const counts: Record<string, number> = {}
    let total = 0
    for (const id of leafIds) {
      addTourWeight(counts, tourDataCache.get(id)?.colors ?? [FALLBACK_COLOR])
      total++
    }
    const { element } = createPieMarkerElement(counts, total)
    element.style.cssText = 'cursor:default;opacity:1;transition:none;pointer-events:none;'
    return element
  }

  function refreshLayerFilters() {
    if (!map.getLayer(LAYER_ID))
      return

    const visibleIds = [...currentIndividualIds].filter(id => !animatingIds.has(id))
    const inVisible: ExpressionSpecification = ['in', ['get', 'id'], ['literal', visibleIds]]

    const unselected: ExpressionSpecification = ['all', inVisible, ['!=', ['get', 'id'], currentSelectedId ?? '']]
    const selected: ExpressionSpecification = ['all', inVisible, ['==', ['get', 'id'], currentSelectedId ?? '']]
    map.setFilter(LAYER_ID, unselected)
    map.setFilter(SELECTED_LAYER_ID, selected)
    map.setFilter(SPLIT_LAYER_ID, ['all', unselected, IS_SPLIT])
    map.setFilter(SELECTED_SPLIT_LAYER_ID, ['all', selected, IS_SPLIT])

    if (map.getLayer(CHECK_LAYER_ID)) {
      map.setFilter(CHECK_LAYER_ID, [
        'all',
        inVisible,
        ['==', ['get', 'completed'], true],
      ] as ExpressionSpecification)
    }

    if (map.getLayer(FRIEND_LAYER_ID)) {
      // Friend glyph is hidden for linked tours — the chain icon takes precedence.
      map.setFilter(FRIEND_LAYER_ID, [
        'all',
        inVisible,
        ['==', ['get', 'isFriendTour'], true],
        ['!=', ['get', 'isLinked'], true],
      ] as ExpressionSpecification)
    }

    if (map.getLayer(LINK_LAYER_ID)) {
      map.setFilter(LINK_LAYER_ID, [
        'all',
        inVisible,
        ['==', ['get', 'isLinked'], true],
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
    const { element, update } = createPieMarkerElement(counts, node.totalLeafCount)
    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')
    element.setAttribute('aria-label', getAriaLabel(node.totalLeafCount))

    const onExpand = () => {
      if (currentNode.splitZoom > map.getMaxZoom()) {
        if (spiderfier.getActiveClusterId() !== currentNode.id) {
          const leaves = currentNode.leafIds.map(id => ({
            id,
            colors: tourDataCache.get(id)?.colors ?? [FALLBACK_COLOR],
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

    // Update visible leaf set before filter refresh; pinned segments are never in the tree.
    currentIndividualIds = new Set(
      [...forest.filter(n => n.kind === 'leaf').map(n => n.id), ...pinnedIds],
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
            spawnTemp(makeDotEl(tourData.colors), node.centroid, classification.targetCentroid, () => {
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
            spawnTemp(makeDotEl(tourData.colors), classification.sourceCentroid, treeNode.coord, () => {
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

    // Split-marker images are drawn on first use, from the colours in their id. A style switch
    // drops every image; this handler simply draws them again. Registered once per layer.
    if (!pieImagesHandled) {
      pieImagesHandled = true
      map.on('styleimagemissing', ({ id }) => {
        const colors = pieImageColors(id)
        const segment = segmentBadgeNumber(id)
        const pixelRatio = window.devicePixelRatio || 1
        const image = colors
          ? drawPieImage(colors, MARKER_RADIUS, pixelRatio)
          : segment && drawSegmentBadge(segment, pixelRatio)
        if (image && !map.hasImage(id))
          map.addImage(id, image, { pixelRatio })
      })
    }

    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addSource(PREVIEW_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addSource(DETAIL_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['in', ['get', 'id'], ['literal', []]],
      paint: {
        'circle-radius': MARKER_CIRCLE_RADIUS,
        'circle-color': unlessSplit(COLOR_EXPR),
        'circle-opacity': MARKER_CIRCLE_OPACITY,
        'circle-opacity-transition': { duration: 200 },
        // A focused outing's segments wear a thin white ring (the selected one its thicker one).
        'circle-stroke-width': ['case', ['has', 'segmentBadge'], 2, 0],
        'circle-stroke-color': '#ffffff',
      },
    })

    map.addLayer({
      id: SELECTED_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['in', ['get', 'id'], ['literal', []]],
      paint: {
        'circle-radius': SELECTED_CIRCLE_RADIUS,
        'circle-color': unlessSplit(COLOR_EXPR),
        'circle-opacity': 1,
        'circle-opacity-transition': { duration: 200 },
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })

    // Unselected split fills sit under the selected circle; the selected one on top of it.
    addSplitLayer(map, SPLIT_LAYER_ID, SOURCE_ID, MARKER_CIRCLE_RADIUS, MARKER_CIRCLE_OPACITY, SELECTED_LAYER_ID)
    addSplitLayer(map, SELECTED_SPLIT_LAYER_ID, SOURCE_ID, SELECTED_CIRCLE_RADIUS, 1)

    // Start/end detail markers — inserted BEFORE the goal circle so the goal
    // always stacks on top when they overlap. Circle mirrors the goal's paint
    // constants; the draft tone uses the lighter preview palette.
    // An outing's handover (`via`) is a small white ring in its next segment's colour (D21).
    const IS_VIA: ExpressionSpecification = ['==', ['get', 'pointKind'], 'via']
    map.addLayer({
      id: DETAIL_CIRCLE_LAYER_ID,
      type: 'circle',
      source: DETAIL_SOURCE_ID,
      paint: {
        'circle-radius': ['case', IS_VIA, VIA_CIRCLE_RADIUS, MARKER_CIRCLE_RADIUS],
        'circle-color': ['case', IS_VIA, '#ffffff', unlessSplit(['case', ['get', 'draft'], PREVIEW_COLOR_EXPR, COLOR_EXPR])],
        'circle-opacity': MARKER_CIRCLE_OPACITY,
        'circle-stroke-width': ['case', IS_VIA, 3, 0],
        'circle-stroke-color': COLOR_EXPR,
      },
    }, LAYER_ID)
    addSplitLayer(map, DETAIL_SPLIT_LAYER_ID, DETAIL_SOURCE_ID, MARKER_CIRCLE_RADIUS, MARKER_CIRCLE_OPACITY, LAYER_ID)

    const startIconLoaded = await loadWhiteGlyphIcon(map, START_ICON_ID, START_GLYPH_SVG)
    const endIconLoaded = await loadWhiteGlyphIcon(map, END_ICON_ID, END_GLYPH_SVG)
    if (startIconLoaded && endIconLoaded) {
      map.addLayer({
        id: DETAIL_ICON_LAYER_ID,
        type: 'symbol',
        source: DETAIL_SOURCE_ID,
        filter: ['!=', ['get', 'pointKind'], 'via'],
        layout: {
          'icon-image': ['match', ['get', 'pointKind'], 'end', END_ICON_ID, START_ICON_ID],
          'icon-size': 0.7,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      }, LAYER_ID)
    }

    spiderfier.setup()

    map.addLayer({
      id: PREVIEW_LAYER_ID,
      type: 'circle',
      source: PREVIEW_SOURCE_ID,
      paint: {
        'circle-radius': PREVIEW_CIRCLE_RADIUS,
        'circle-color': unlessSplit(PREVIEW_COLOR_EXPR),
        'circle-opacity': 0.9,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    })
    addSplitLayer(map, PREVIEW_SPLIT_LAYER_ID, PREVIEW_SOURCE_ID, PREVIEW_CIRCLE_RADIUS, 0.9)

    // Friend indicator is added BEFORE the completion check so the check (added
    // last below) stacks on top — completion must read above everything else.
    const friendIconLoaded = await loadFriendIcon(map)
    if (friendIconLoaded) {
      // Friendship indicator is centered in the marker and sized to nearly fill
      // it (28px icon × 0.8 ≈ 22px inside a 28px circle → even ~3px padding).
      // Tinted a lighter shade of the tour-type colour so the white completion
      // check stays legible on top of it for completed friend tours.
      map.addLayer({
        id: FRIEND_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['in', ['get', 'id'], ['literal', []]],
        layout: {
          'icon-image': FRIEND_ICON_ID,
          'icon-size': 0.8,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': PREVIEW_COLOR_EXPR,
          'icon-opacity': 1,
          'icon-opacity-transition': { duration: 200 },
        },
      })
    }

    // Link indicator BEFORE the check so the white completion ✓ stacks above
    // it. Same shape / size / tint as the friend glyph — fills the marker,
    // PREVIEW_COLOR_EXPR keeps the completion mark legible on top.
    const linkIconLoaded = await loadLinkIcon(map)
    if (linkIconLoaded) {
      map.addLayer({
        id: LINK_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['in', ['get', 'id'], ['literal', []]],
        layout: {
          'icon-image': LINK_ICON_ID,
          'icon-size': 0.8,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': PREVIEW_COLOR_EXPR,
          'icon-opacity': 1,
          'icon-opacity-transition': { duration: 200 },
        },
      })
    }

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

    // Last, so the number reads above every other marker glyph.
    map.addLayer({
      id: SEGMENT_BADGE_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'segmentBadge'],
      layout: {
        'icon-image': ['get', 'segmentBadge'],
        'icon-offset': [12, -12],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })

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

  /** `segmentIds`: the focused outing's segments in order — pinned, ringed and numbered. */
  function updateTours(
    tours: Tour[],
    selectedTourId: string | null,
    linkedTourIds: Set<string> = new Set(),
    segmentIds: string[] = [],
  ) {
    const source = map.getSource<GeoJSONSource>(SOURCE_ID)
    if (!source)
      return

    cancelAllAnimations()

    tourDataCache.clear()
    for (const tour of tours) {
      tourDataCache.set(tour.id, {
        lngLat: [tour.goal.lng, tour.goal.lat],
        colors: tourColors(routeOrder(tour), TOUR_TYPE_COLORS),
      })
    }

    pinnedIds = new Set(segmentIds)
    currentTree = buildClusterTree(tours.filter(t => !pinnedIds.has(t.id)))
    splitZooms = collectSplitZooms(currentTree)
    currentSelectedId = selectedTourId

    const geoJson = toursToGeoJson(tours, { linkedTourIds })
    for (const feature of geoJson.features) {
      const id = feature.properties!.id as string
      feature.properties!.pieImage = pieImageId(tourDataCache.get(id)!.colors)
      if (pinnedIds.has(id))
        feature.properties!.segmentBadge = segmentBadgeId(segmentIds.indexOf(id) + 1)
    }
    source.setData(geoJson)
    commitFrame(currentTree, map.getZoom())
  }

  function updatePreview(goal: { lng: number, lat: number } | null, tourTypes: TourType[]) {
    const source = map.getSource<GeoJSONSource>(PREVIEW_SOURCE_ID)
    if (!source)
      return

    source.setData({
      type: 'FeatureCollection',
      features: goal
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [goal.lng, goal.lat] },
              properties: {
                tourType: tourTypes[0] ?? null,
                pieImage: pieImageId(tourColors(tourTypes, TOUR_TYPE_PREVIEW_COLORS)),
              },
            },
          ]
        : [],
    })
  }

  function updateDetailMarkers(markers: DetailMarker[]) {
    const source = map.getSource<GeoJSONSource>(DETAIL_SOURCE_ID)
    if (!source)
      return

    source.setData({
      type: 'FeatureCollection',
      features: markers.map(m => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.lngLat.lng, m.lngLat.lat] },
        properties: {
          pointKind: m.pointKind,
          tourType: m.tourTypes[0] ?? null,
          draft: m.draft,
          // ponytail: a handover ring takes the primary colour only, no split.
          pieImage: m.pointKind === 'via'
            ? null
            : pieImageId(tourColors(m.tourTypes, m.draft ? TOUR_TYPE_PREVIEW_COLORS : TOUR_TYPE_COLORS)),
        },
      })),
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

  return { setup, updateTours, updatePreview, updateDetailMarkers, cleanup }
}
