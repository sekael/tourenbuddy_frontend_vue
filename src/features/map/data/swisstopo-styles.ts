/** Available Swisstopo base map styles for MapLibre. */
export interface MapStyle {
  labelKey: string
  /** MapLibre style URL or JSON path */
  style: string
}

export const SWISSTOPO_STYLES: MapStyle[] = [
  {
    labelKey: 'map.styles.base',
    style: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.basemap.vt/style.json',
  },
  {
    labelKey: 'map.styles.classic',
    style: '/swisstopo_wmts_style.json',
  },
]
