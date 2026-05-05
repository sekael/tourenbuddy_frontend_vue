import type { ClusterSnapshot } from '@/features/map/presentation/components/cluster-transitions'
import { describe, expect, it } from 'vitest'
import { diffSnapshots, snapshotClusters } from '@/features/map/presentation/components/cluster-transitions'

function makeMap(stubFeatures: { cluster_id: number, coords: [number, number] }[]) {
  return {
    querySourceFeatures: (_sourceId: string, _opts: unknown) => stubFeatures.map(f => ({
      properties: { cluster_id: f.cluster_id, point_count: 2 },
      geometry: { type: 'Point', coordinates: f.coords },
    })),
    getSource: () => undefined,
  } as unknown as import('maplibre-gl').Map
}

describe('snapshotClusters', () => {
  it('should return empty map when no cluster features', () => {
    const map = makeMap([])
    const snapshot = snapshotClusters(map, 'tours')
    expect(snapshot.size).toBe(0)
  })

  it('should record one entry per unique cluster_id', () => {
    const map = makeMap([
      { cluster_id: 1, coords: [8.0, 47.0] },
      { cluster_id: 2, coords: [8.5, 47.5] },
      { cluster_id: 1, coords: [8.0, 47.0] }, // duplicate
    ])
    const snapshot = snapshotClusters(map, 'tours')
    expect(snapshot.size).toBe(2)
    expect(snapshot.get(1)!.lngLat).toEqual([8.0, 47.0])
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
