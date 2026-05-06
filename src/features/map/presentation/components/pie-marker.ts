import type { TourType } from '@/features/tours/data/models/tour-type'

export const MARKER_RADIUS = 18
export const MARKER_SIZE = MARKER_RADIUS * 2

export type CountMap = Record<string, number>
export type PaletteMap = Record<TourType, string>
const FALLBACK_COLOR = '#78716C'

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polarToCartesian(cx, cy, r, startDeg)
  const [ex, ey] = polarToCartesian(cx, cy, r, endDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`
}

/** Computes SVG path + color pairs for a pie chart. Returns empty array when total is 0. */
export function buildSlices(
  counts: CountMap,
  total: number,
  palette: PaletteMap,
): { path: string, color: string }[] {
  if (total === 0)
    return []

  const cx = MARKER_RADIUS
  const cy = MARKER_RADIUS
  const r = MARKER_RADIUS

  const entries = Object.entries(counts).filter(([, v]) => v > 0)
  if (entries.length === 0)
    return []

  // Single type — full circle (avoid degenerate arc path)
  if (entries.length === 1) {
    const [type] = entries[0]!
    const color = (palette as Record<string, string>)[type] ?? FALLBACK_COLOR
    return [{ path: `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`, color }]
  }

  const slices: { path: string, color: string }[] = []
  let currentAngle = 0

  for (const [type, count] of entries) {
    const sliceAngle = (count / total) * 360
    const endAngle = currentAngle + sliceAngle
    const path = describeArc(cx, cy, r, currentAngle, endAngle)
    const color = (palette as Record<string, string>)[type] ?? FALLBACK_COLOR
    slices.push({ path, color })
    currentAngle = endAngle
  }

  return slices
}

function buildSvgElement(counts: CountMap, total: number, palette: PaletteMap): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', String(MARKER_SIZE))
  svg.setAttribute('height', String(MARKER_SIZE))
  svg.setAttribute('viewBox', `0 0 ${MARKER_SIZE} ${MARKER_SIZE}`)

  const slices = buildSlices(counts, total, palette)
  for (const { path, color } of slices) {
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    pathEl.setAttribute('d', path)
    pathEl.setAttribute('fill', color)
    svg.appendChild(pathEl)
  }

  // White backdrop disc for count label readability
  const backdropR = 10
  const cx = MARKER_RADIUS
  const cy = MARKER_RADIUS
  const backdrop = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  backdrop.setAttribute('cx', String(cx))
  backdrop.setAttribute('cy', String(cy))
  backdrop.setAttribute('r', String(backdropR))
  backdrop.setAttribute('fill', 'white')
  backdrop.setAttribute('fill-opacity', '0.9')
  svg.appendChild(backdrop)

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  text.setAttribute('x', String(cx))
  text.setAttribute('y', String(cy))
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dominant-baseline', 'central')
  text.setAttribute('font-size', '10')
  text.setAttribute('font-weight', '600')
  text.setAttribute('font-family', 'Inter, sans-serif')
  text.setAttribute('fill', '#1c1917')
  text.textContent = String(total)
  svg.appendChild(text)

  return svg
}

export interface PieMarkerResult {
  element: HTMLElement
  update: (counts: CountMap, total: number) => void
}

/**
 * Creates a pie-chart SVG element for a cluster marker.
 * Returns the wrapper element and an update function for in-place mutation.
 */
export function fadeIn(el: HTMLElement): void {
  requestAnimationFrame(() => {
    el.style.opacity = '1'
  })
}

export function fadeOut(el: HTMLElement, onDone: () => void): void {
  if (el.style.opacity === '0') {
    onDone()
    return
  }

  let done = false
  let timer: ReturnType<typeof setTimeout>
  const handler = (e: Event) => {
    if (e.target === el)
      fire()
  }
  function fire() {
    if (done)
      return
    done = true
    clearTimeout(timer)
    el.removeEventListener('transitionend', handler)
    onDone()
  }

  el.addEventListener('transitionend', handler)
  el.style.opacity = '0'
  timer = setTimeout(fire, 250)
}

export function createPieMarkerElement(
  counts: CountMap,
  total: number,
  palette: PaletteMap,
): PieMarkerResult {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'cursor:pointer;opacity:0;transition:opacity 200ms ease;'

  let currentSvg = buildSvgElement(counts, total, palette)
  wrapper.appendChild(currentSvg)

  function update(newCounts: CountMap, newTotal: number) {
    const newSvg = buildSvgElement(newCounts, newTotal, palette)
    wrapper.replaceChild(newSvg, currentSvg)
    currentSvg = newSvg
  }

  return { element: wrapper, update }
}
