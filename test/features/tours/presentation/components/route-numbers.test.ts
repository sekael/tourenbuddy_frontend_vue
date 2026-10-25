import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseIcon from '@/core/components/base-icon.vue'
import { TOUR_TYPE_ICONS } from '@/features/tours/data/models/tour-type'
import RouteNumbers from '@/features/tours/presentation/components/route-numbers.vue'

const icons = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-testid="${id}"]`).findAllComponents(BaseIcon).map(i => i.props('name'))

describe('routeNumbers', () => {
  it('should leave out the zero descent of a tour that ends at its goal', () => {
    const w = mount(RouteNumbers, { props: { metrics: { ascent: 447, descent: 0, distance: null } } })
    expect(w.find('[data-testid="route-ascent"]').text()).toContain('447\u00A0m')
    expect(w.find('[data-testid="route-descent"]').exists()).toBe(false)
  })

  it('should show the activities of a shared way, glider last, so it never reads as a pure flight', () => {
    const w = mount(RouteNumbers, { props: { metrics: { ascent: 1106, descent: 2174, distance: null }, flight: { up: null, down: ['skitour', 'paragliding'] } } })
    expect(w.find('[data-testid="route-descent"]').text()).toMatch(/↓.*tours.route.descentPartFlown/)
    expect(icons(w, 'route-descent')).toEqual([TOUR_TYPE_ICONS.skitour, 'paragliding'])
  })

  it('should keep the arrow and show the glider alone for a pure flight, up or down', () => {
    const w = mount(RouteNumbers, { props: { metrics: { ascent: 794, descent: 842, distance: null }, flight: { up: ['paragliding'], down: ['paragliding'] } } })
    expect([icons(w, 'route-ascent'), icons(w, 'route-descent')]).toEqual([['paragliding'], ['paragliding']])
    expect([w.find('[data-testid="route-ascent"]').text(), w.find('[data-testid="route-descent"]').text()])
      .toEqual([expect.stringMatching(/↑.*tours.route.flightUp/), expect.stringMatching(/↓.*tours.route.flight/)])
  })
})
