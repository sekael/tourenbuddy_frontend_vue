import type { ClusterSnapshot } from '@/features/map/presentation/components/cluster-transitions'
import { describe, expect, it } from 'vitest'
import { diffSnapshots, snapshotClusters } from '@/features/map/presentation/components/cluster-transitions'
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_POINTS,
  CLUSTER_RADIUS,
} from '@/features/map/presentation/components/tours-marker-layer'

// Minimal stub matching the ClusterIndex interface
function makeStubIndex(clusters: Array<{ id: number, lngLat: [number, number], leafIds: string[] }>) {
  return {
    getClusters: (_bbox: [number, number, number, number], _zoom: number) =>
      clusters.map(c => ({
        geometry: { coordinates: c.lngLat },
        properties: { cluster: true, cluster_id: c.id, point_count: c.leafIds.length },
      })),
    getLeaves: (clusterId: number) => {
      const cluster = clusters.find(c => c.id === clusterId)
      return (cluster?.leafIds ?? []).map(id => ({ properties: { id } }))
    },
  }
}

describe('snapshotClusters (JS index)', () => {
  it('should return empty map when index has no clusters', () => {
    const index = makeStubIndex([])
    const snapshot = snapshotClusters(index, [7, 46, 9, 48], 10)
    expect(snapshot.size).toBe(0)
  })

  it('should return one entry per cluster with populated leafIds', () => {
    const index = makeStubIndex([
      { id: 1, lngLat: [8.0, 47.0], leafIds: ['tour-a', 'tour-b'] },
    ])
    const snapshot = snapshotClusters(index, [7, 46, 9, 48], 10)
    expect(snapshot.size).toBe(1)
    expect(snapshot.get(1)!.lngLat).toEqual([8.0, 47.0])
    expect(snapshot.get(1)!.leafIds).toEqual(['tour-a', 'tour-b'])
  })

  it('should return entries for multiple clusters with correct leafIds each', () => {
    const index = makeStubIndex([
      { id: 1, lngLat: [8.0, 47.0], leafIds: ['a', 'b'] },
      { id: 2, lngLat: [8.5, 47.5], leafIds: ['c'] },
    ])
    const snapshot = snapshotClusters(index, [7, 46, 9, 48], 10)
    expect(snapshot.size).toBe(2)
    expect(snapshot.get(2)!.leafIds).toEqual(['c'])
  })

  it('should skip features without cluster property', () => {
    const index = {
      getClusters: () => [
        { geometry: { coordinates: [8, 47] }, properties: { id: 'individual-1' } },
      ],
      getLeaves: () => [],
    }
    const snapshot = snapshotClusters(index, [7, 46, 9, 48], 10)
    expect(snapshot.size).toBe(0)
  })
})

describe('cluster config constants', () => {
  it('gL source and JS index should share CLUSTER_RADIUS = 50', () => {
    expect(CLUSTER_RADIUS).toBe(50)
  })

  it('gL source and JS index should share CLUSTER_MAX_ZOOM = 14', () => {
    expect(CLUSTER_MAX_ZOOM).toBe(14)
  })

  it('gL source and JS index should share CLUSTER_MIN_POINTS = 2', () => {
    expect(CLUSTER_MIN_POINTS).toBe(2)
  })
})

describe('diffSnapshots', () => {
  it('should detect split leaves when cluster breaks into individuals', () => {
    const prevSnapshot: ClusterSnapshot = new Map([
      [10, { lngLat: [8.0, 47.0], leafIds: ['tour-a', 'tour-b'] }],
    ])
    const newSnapshot: ClusterSnapshot = new Map()
    const prevIndividualIds = new Set<string>()
    const newIndividualIds = new Set(['tour-a', 'tour-b'])

    const { splitLeaves, mergeLeaves } = diffSnapshots(
      prevSnapshot,
      newSnapshot,
      prevIndividualIds,
      newIndividualIds,
    )

    expect(splitLeaves).toHaveLength(2)
    expect(splitLeaves.map(l => l.tourId)).toContain('tour-a')
    expect(splitLeaves.map(l => l.tourId)).toContain('tour-b')
    expect(mergeLeaves).toHaveLength(0)
  })

  it('should detect merge leaves when individuals enter a new cluster', () => {
    const prevSnapshot: ClusterSnapshot = new Map()
    const newSnapshot: ClusterSnapshot = new Map([
      [20, { lngLat: [8.0, 47.0], leafIds: ['tour-c', 'tour-d'] }],
    ])
    const prevIndividualIds = new Set(['tour-c', 'tour-d'])
    const newIndividualIds = new Set<string>()

    const { splitLeaves, mergeLeaves } = diffSnapshots(
      prevSnapshot,
      newSnapshot,
      prevIndividualIds,
      newIndividualIds,
    )

    expect(mergeLeaves).toHaveLength(2)
    expect(mergeLeaves.map(l => l.tourId)).toContain('tour-c')
    expect(splitLeaves).toHaveLength(0)
  })

  it('should produce empty lists when no transitions occur', () => {
    const snapshot: ClusterSnapshot = new Map([
      [1, { lngLat: [8.0, 47.0], leafIds: ['tour-a'] }],
    ])
    const { splitLeaves, mergeLeaves } = diffSnapshots(
      snapshot,
      snapshot,
      new Set<string>(),
      new Set<string>(),
    )
    expect(splitLeaves).toHaveLength(0)
    expect(mergeLeaves).toHaveLength(0)
  })
})
