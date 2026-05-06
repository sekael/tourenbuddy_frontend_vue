import type { TourType } from '@/features/tours/data/models/tour-type'
import type { Tour } from '@/features/tours/domain/entities/tour'

export const CLUSTER_RADIUS = 50

export interface LeafNode {
  kind: 'leaf'
  id: string
  coord: [number, number]
  tourType: TourType | null
}

export interface InternalNode {
  kind: 'internal'
  id: string
  centroid: [number, number]
  leafIds: string[]
  children: [TreeNode, TreeNode]
  splitZoom: number
  totalLeafCount: number
}

export type TreeNode = LeafNode | InternalNode

export function pixelsPerMeter(latDeg: number, zoom: number): number {
  return (256 * 2 ** zoom) / (40075016.686 * Math.cos((latDeg * Math.PI) / 180))
}

export function solveSplitZoom(distMeters: number, latDeg: number, radiusPx: number): number {
  if (distMeters === 0)
    return +Infinity
  return Math.log2((radiusPx * 40075016.686 * Math.cos((latDeg * Math.PI) / 180)) / (256 * distMeters))
}

export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const sinDlat2 = Math.sin(dLat / 2)
  const sinDlng2 = Math.sin(dLng / 2)
  const aa = sinDlat2 * sinDlat2 + Math.cos(lat1) * Math.cos(lat2) * sinDlng2 * sinDlng2
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function centroidOf(node: TreeNode): [number, number] {
  return node.kind === 'leaf' ? node.coord : node.centroid
}

function leafCountOf(node: TreeNode): number {
  return node.kind === 'leaf' ? 1 : node.totalLeafCount
}

function leafIdsOf(node: TreeNode): string[] {
  return node.kind === 'leaf' ? [node.id] : node.leafIds
}

function clampMonotonicity(node: InternalNode, minZoom: number): void {
  if (node.splitZoom < minZoom)
    node.splitZoom = minZoom
  for (const child of node.children) {
    if (child.kind === 'internal')
      clampMonotonicity(child, node.splitZoom)
  }
}

export function buildClusterTree(tours: Tour[], radiusPx: number = CLUSTER_RADIUS): TreeNode | null {
  if (tours.length === 0)
    return null

  let counter = 0
  const nodes: TreeNode[] = tours.map(t => ({
    kind: 'leaf' as const,
    id: t.id,
    coord: [t.goal.lng, t.goal.lat] as [number, number],
    tourType: t.tourType,
  }))

  if (nodes.length === 1)
    return nodes[0]!

  while (nodes.length > 1) {
    let bestI = 0
    let bestJ = 1
    let bestDist = Infinity

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = haversineMeters(centroidOf(nodes[i]!), centroidOf(nodes[j]!))
        if (d < bestDist) {
          bestDist = d
          bestI = i
          bestJ = j
        }
      }
    }

    const a = nodes[bestI]!
    const b = nodes[bestJ]!
    const wA = leafCountOf(a)
    const wB = leafCountOf(b)
    const total = wA + wB
    const cA = centroidOf(a)
    const cB = centroidOf(b)
    const centroid: [number, number] = [
      (cA[0] * wA + cB[0] * wB) / total,
      (cA[1] * wA + cB[1] * wB) / total,
    ]
    const splitZoom = solveSplitZoom(bestDist, centroid[1], radiusPx)
    const leafIds = [...leafIdsOf(a), ...leafIdsOf(b)].sort()

    const merged: InternalNode = {
      kind: 'internal',
      id: `cluster-${counter++}`,
      centroid,
      leafIds,
      children: [a, b],
      splitZoom,
      totalLeafCount: total,
    }

    // Remove bestJ first (higher index) to preserve bestI index
    nodes.splice(bestJ, 1)
    nodes.splice(bestI, 1)
    nodes.push(merged)
  }

  const root = nodes[0]!
  if (root.kind === 'internal')
    clampMonotonicity(root, -Infinity)
  return root
}

export function cutForest(
  root: TreeNode | null,
  zoom: number,
  bbox?: [number, number, number, number],
): TreeNode[] {
  if (!root)
    return []
  const result: TreeNode[] = []

  function walk(node: TreeNode): void {
    if (node.kind === 'leaf') {
      result.push(node)
      return
    }
    if (node.splitZoom <= zoom) {
      walk(node.children[0])
      walk(node.children[1])
    }
    else {
      result.push(node)
    }
  }

  walk(root)

  if (!bbox)
    return result

  return result.filter((node) => {
    const [lng, lat] = node.kind === 'leaf' ? node.coord : node.centroid
    return lng >= bbox[0] && lat >= bbox[1] && lng <= bbox[2] && lat <= bbox[3]
  })
}

export function collectSplitZooms(root: TreeNode | null): number[] {
  if (!root)
    return []
  const zooms: number[] = []

  function walk(node: TreeNode): void {
    if (node.kind === 'internal') {
      zooms.push(node.splitZoom)
      walk(node.children[0])
      walk(node.children[1])
    }
  }

  walk(root)
  return zooms.sort((a, b) => a - b)
}

export function findCrossings(splitZooms: number[], fromZoom: number, toZoom: number): number[] {
  if (fromZoom === toZoom)
    return []
  if (fromZoom < toZoom) {
    return splitZooms.filter(z => z > fromZoom && z <= toZoom)
  }
  return splitZooms.filter(z => z >= toZoom && z < fromZoom)
}

export function buildParentMap(root: TreeNode | null): Map<string, string> {
  const map = new Map<string, string>()

  function walk(node: TreeNode, parentId: string | null): void {
    if (parentId !== null)
      map.set(node.id, parentId)
    if (node.kind === 'internal') {
      walk(node.children[0], node.id)
      walk(node.children[1], node.id)
    }
  }

  if (root)
    walk(root, null)
  return map
}
