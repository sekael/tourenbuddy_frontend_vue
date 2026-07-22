import type { OfflineRegion } from '@/features/map/data/services/offline-region-store'
import type { DownloadProgress } from '@/features/map/data/services/offline-tile-service'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLogger } from '@/core/logging/use-logger'
import { getAllRegions } from '@/features/map/data/services/offline-region-store'
import {
  deleteRegion as deleteRegionService,
  downloadRegion,
  estimateBytes,
  OfflineQuotaError,
  REGION_MAX_ZOOM,
  REGION_MIN_ZOOM,
  sweepOrphanTiles,
} from '@/features/map/data/services/offline-tile-service'

export type DownloadStatus = 'idle' | 'running' | 'error'
export type Bbox = [number, number, number, number]

export const useOfflineMapStore = defineStore('offline-map', () => {
  const logger = useLogger('OfflineMapStore')

  const regions = ref<OfflineRegion[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const usage = ref(0)
  const quota = ref(0)
  const durableStorageAvailable = ref(false)

  const estimate = ref(0)
  const status = ref<DownloadStatus>('idle')
  const progress = ref<DownloadProgress>({ done: 0, total: 0, bytes: 0 })
  let controller: AbortController | null = null

  /**
   * Bytes used by offline maps ALONE (sum of region records) — not whole-origin
   * usage, which also counts the app shell, IndexedDB and other caches.
   */
  const offlineUsage = computed(() => regions.value.reduce((n, r) => n + r.bytes, 0))
  const usedRatio = computed(() => (quota.value ? offlineUsage.value / quota.value : 0))
  /** Bytes we allow before the next download would breach the 90% safety line. */
  const freeHeadroom = computed(() => Math.max(0, quota.value * 0.9 - usage.value))
  /** Soft warning: estimate eats >70% of remaining headroom (button stays enabled). */
  const estimateWarns = computed(
    () => freeHeadroom.value > 0 && estimate.value > freeHeadroom.value * 0.7,
  )
  /** Hard block: estimate exceeds the real ceiling. */
  const estimateBlocks = computed(
    () => quota.value > 0 && estimate.value > freeHeadroom.value,
  )

  async function refreshUsage() {
    const est = await navigator.storage?.estimate?.()
    usage.value = est?.usage ?? 0
    quota.value = est?.quota ?? 0
    durableStorageAvailable.value = (await navigator.storage?.persisted?.()) ?? false
  }

  async function loadRegions() {
    loading.value = true
    error.value = null
    try {
      await sweepOrphanTiles()
      regions.value = await getAllRegions()
      await refreshUsage()
    }
    catch (err) {
      logger.error('loadRegions failed', err)
      error.value = 'offlineMap.errors.load'
    }
    finally {
      loading.value = false
    }
  }

  function updateEstimate(bbox: Bbox | null) {
    estimate.value = bbox ? estimateBytes(bbox, REGION_MIN_ZOOM, REGION_MAX_ZOOM) : 0
  }

  /** Ask the browser for durable (non-evictable) storage before the first download. */
  async function ensureDurable(): Promise<boolean> {
    durableStorageAvailable.value = (await navigator.storage?.persist?.()) ?? false
    return durableStorageAvailable.value
  }

  /** Run a cancelable download of `bbox`, refreshing the region list on success. */
  async function download(label: string, bbox: Bbox): Promise<boolean> {
    controller = new AbortController()
    status.value = 'running'
    progress.value = { done: 0, total: 0, bytes: 0 }
    error.value = null
    try {
      await ensureDurable()
      await downloadRegion(
        {
          id: crypto.randomUUID(),
          label,
          bbox,
          minZoom: REGION_MIN_ZOOM,
          maxZoom: REGION_MAX_ZOOM,
        },
        { signal: controller.signal, onProgress: p => (progress.value = p) },
      )
      await loadRegions()
      status.value = 'idle'
      return true
    }
    catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        status.value = 'idle' // user canceled — not an error state
        return false
      }
      logger.error('download failed', err)
      error.value = err instanceof OfflineQuotaError
        ? 'offlineMap.errors.quota'
        : 'offlineMap.errors.download'
      status.value = 'error'
      return false
    }
    finally {
      controller = null
    }
  }

  function cancelDownload() {
    controller?.abort()
  }

  async function deleteRegion(id: string) {
    error.value = null
    try {
      await deleteRegionService(id)
      await loadRegions()
    }
    catch (err) {
      logger.error('deleteRegion failed', err)
      error.value = 'offlineMap.errors.delete'
    }
  }

  return {
    regions,
    loading,
    error,
    usage,
    offlineUsage,
    quota,
    usedRatio,
    freeHeadroom,
    durableStorageAvailable,
    estimate,
    estimateWarns,
    estimateBlocks,
    status,
    progress,
    refreshUsage,
    loadRegions,
    updateEstimate,
    ensureDurable,
    download,
    cancelDownload,
    deleteRegion,
  }
})
