/** Available Swisstopo base map styles for MapLibre. */
export interface MapStyle {
  label: string
  /** MapLibre style URL or JSON path */
  style: string
}

export const SWISSTOPO_STYLES: MapStyle[] = [
  {
    label: 'Base',
    style: 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.leichte-basiskarte.vt/style.json',
  },
  {
    label: 'Full Color',
    style: '/swisstopo_wmts_style.json',
  },
]
