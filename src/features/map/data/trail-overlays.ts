export type TrailOverlayId = 'hiking' | 'ski'

/** A Swisstopo WMTS trail network drawn over the base map. */
export interface TrailOverlay {
  id: TrailOverlayId
  /** GeoAdmin layer id, used for WMTS tiles and the identify API. */
  layerBodId: string
  /** Highest WMTS zoom level; MapLibre overzooms beyond it. */
  maxzoom: number
  labelKey: string
  thumbnail: string
  /** Whether a map tap looks up features of this overlay. */
  identifiable: boolean
}

/** Array order is draw order (later = on top). */
export const TRAIL_OVERLAYS: TrailOverlay[] = [
  {
    id: 'hiking',
    layerBodId: 'ch.swisstopo.swisstlm3d-wanderwege',
    maxzoom: 18,
    labelKey: 'map.layers.overlays.hiking',
    thumbnail: '/map-layers/hiking.png',
    identifiable: false,
  },
  {
    id: 'ski',
    layerBodId: 'ch.swisstopo-karto.skitouren',
    maxzoom: 17,
    labelKey: 'map.layers.overlays.ski',
    thumbnail: '/map-layers/ski.png',
    identifiable: true,
  },
]

export function wmtsTileUrl(layerBodId: string): string {
  return `https://wmts.geo.admin.ch/1.0.0/${layerBodId}/default/current/3857/{z}/{x}/{y}.png`
}
