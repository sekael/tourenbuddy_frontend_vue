import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'

export type ClusterSnapshot = Map<number, { lngLat: [number, number], leafIds: string[] }>

/**
 * Captures the current set of visible cluster features with their centroids and leaf tour IDs.
 * Uses querySourceFeatures (sync) for centroids; leaf IDs are fetched async via getClusterLeaves.
 * Returns a snapshot map keyed by cluster_id.
 *
 * Note: leafIds may be empty if getClusterLeaves is not yet available (style not loaded).
 */
export async function snapshotClustersAsync(
  map: MapLibreMap,
  sourceId: string,
): Promise<ClusterSnapshot> {
  const snapshot: ClusterSnapshot = new Map()

  const features = map.querySourceFeatures(sourceId, {
    filter: ['has', 'point_count'],
  })

  const source = map.getSource(sourceId) as GeoJSONSource | undefined
  if (!source)
    return snapshot

  const deduped = new Map<number, { lngLat: [number, number] }>()
  for (const feature of features) {
    const clusterId = feature.properties?.cluster_id as number | undefined
    if (clusterId == null)
      continue
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    if (!deduped.has(clusterId))
      deduped.set(clusterId, { lngLat: coords })
  }

  await Promise.all(
    [...deduped.entries()].map(async ([clusterId, { lngLat }]) => {
      try {
        const leaves = await new Promise<GeoJSON.Feature[]>((resolve, reject) => {
          source.getClusterLeaves(clusterId, Infinity, 0, (err, result) => {
            if (err)
              reject(err)
            else
              resolve(result ?? [])
          })
        })
        const leafIds = leaves
          .map(f => f.properties?.id as string)
          .filter(Boolean)
        snapshot.set(clusterId, { lngLat, leafIds })
      }
      catch {
        snapshot.set(clusterId, { lngLat, leafIds: [] })
      }
    }),
  )

  return snapshot
}

/**
 * Synchronous snapshot using only querySourceFeatures (no async leaf lookup).
 * Returns centroids only; leafIds will be empty.
 * Used on zoomstart where we need a fast synchronous snapshot.
 */
export function snapshotClusters(map: MapLibreMap, sourceId: string): ClusterSnapshot {
  const snapshot: ClusterSnapshot = new Map()
  const features = map.querySourceFeatures(sourceId, {
    filter: ['has', 'point_count'],
  })
  for (const feature of features) {
    const clusterId = feature.properties?.cluster_id as number | undefined
    if (clusterId == null || snapshot.has(clusterId))
      continue
    const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
    snapshot.set(clusterId, { lngLat: coords, leafIds: [] })
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

  // Split: was in prev cluster, now individual
  for (const [clusterId, { leafIds }] of prevSnapshot) {
    for (const tourId of leafIds) {
      if (newIndividualIds.has(tourId)) {
        splitLeaves.push({ tourId, fromClusterId: clusterId })
      }
    }
  }

  // Merge: was individual before, now in a new cluster
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
