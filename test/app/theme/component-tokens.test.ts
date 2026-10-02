import { describe, expect, it } from 'vitest'
import tokensCss from '@/app/theme/tokens.css?raw'

// Component tokens (`--chip-*`, `--input-*`, …) are defined only by a design
// variant. Classic stays unchanged ONLY because every consumer carries its
// Classic value as the var() fallback — a bare `var(--chip-radius)` would
// resolve to `unset` in Classic and silently restyle the component.
const COMPONENT_TOKEN = /--(?:button-(?:min-height|tracking|primary-shadow|danger-shadow|outline|secondary|primary-outline|danger-outline|text)|overlay-|heading-section-|field-label-|input-|chip-|tabs?-|divider-|section-divider-|tonal-tint|toggle-(?:row|flex)|card-|sheet-snap-|sheet-swap-|view-swap-|tab-flex|icon-verified-|map-chip-|tint-text-|fab-dot-|fab-badge-)[a-z-]*/

const vueFiles = import.meta.glob('/src/**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

function rootBlock(css: string): string {
  return css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
}

describe('component tokens', () => {
  it('should not be defined in the Classic :root block', () => {
    const defined = [...rootBlock(tokensCss).matchAll(/^\s*(--[a-z-]+):/gm)].map(m => m[1])
    expect(defined.filter(name => COMPONENT_TOKEN.test(name))).toEqual([])
  })

  it('should always be consumed with a Classic fallback', () => {
    expect(Object.keys(vueFiles).length).toBeGreaterThan(50)
    const bare = Object.entries(vueFiles).flatMap(([file, source]) =>
      [...source.matchAll(/var\(\s*(--[a-z-]+)\s*\)/g)]
        .filter(m => COMPONENT_TOKEN.test(m[1]))
        .map(m => `${file}: ${m[0]}`),
    )
    expect(bare).toEqual([])
  })
})
