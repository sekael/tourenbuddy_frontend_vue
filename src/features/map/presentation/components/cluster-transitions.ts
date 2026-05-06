export type ClusterSnapshot = Map<number, { lngLat: [number, number], leafIds: string[] }>

interface ClusterIndex {
  getClusters: (
    bbox: [number, number, number, number],
    zoom: number,
  ) => Array<{
    geometry: { coordinates: number[] }
    properties: Record<string, unknown> | null
  }>
  getLeaves: (
    clusterId: number,
    limit?: number,
    offset?: number,
  ) => Array<{ properties: Record<string, unknown> | null }>
}

/**
 * Synchronously snapshots visible clusters from a JS-side Supercluster index.
 * Returns a map keyed by cluster_id with populated lngLat and leafIds.
 */
export function snapshotClusters(
  index: ClusterIndex,
  bbox: [number, number, number, number],
  zoom: number,
): ClusterSnapshot {
  const snapshot: ClusterSnapshot = new Map()
  const features = index.getClusters(bbox, Math.floor(zoom))
  for (const f of features) {
    if (!f.properties?.cluster)
      continue
    const clusterId = f.properties.cluster_id as number
    const lngLat = f.geometry.coordinates as [number, number]
    const leafIds = index
      .getLeaves(clusterId, Infinity, 0)
      .map(l => l.properties?.id as string)
      .filter(Boolean)
    snapshot.set(clusterId, { lngLat, leafIds })
  }
  return snapshot
}

/**
 * Given before and after snapshots, computes split and merge leaves.
 *
 * Split: tour was a leaf in prevSnapshot, is now an individual feature (in newIndividualIds).
 * Merge: tour was an individual (in prevIndividualIds), is now a leaf in a new cluster.
 */
export function diffSnapshots(
  prevSnapshot: ClusterSnapshot,
  newSnapshot: ClusterSnapshot,
  prevIndividualIds: Set<string>,
  newIndividualIds: Set<string>,
): {
  splitLeaves: { tourId: string, fromClusterId: number }[]
  mergeLeaves: { tourId: string, toClusterId: number }[]
} {
  const splitLeaves: { tourId: string, fromClusterId: number }[] = []
  const mergeLeaves: { tourId: string, toClusterId: number }[] = []

  for (const [clusterId, { leafIds }] of prevSnapshot) {
    for (const tourId of leafIds) {
      if (newIndividualIds.has(tourId)) {
        splitLeaves.push({ tourId, fromClusterId: clusterId })
      }
    }
  }

  const prevLeafIds = new Set<string>()
  for (const { leafIds } of prevSnapshot.values()) {
    for (const id of leafIds)
      prevLeafIds.add(id)
  }

  for (const [clusterId, { leafIds }] of newSnapshot) {
    for (const tourId of leafIds) {
      if (prevIndividualIds.has(tourId) && !prevLeafIds.has(tourId)) {
        mergeLeaves.push({ tourId, toClusterId: clusterId })
      }
    }
  }

  return { splitLeaves, mergeLeaves }
}
