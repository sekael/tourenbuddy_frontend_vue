import type { Tour } from '@/features/tours/domain/entities/tour'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BaseIcon from '@/core/components/base-icon.vue'
import TourFactRows from '@/features/tours/presentation/components/tour-fact-rows.vue'

const START = { lng: 7.9, lat: 46.6 }

function mountRows(overrides: Partial<Tour> = {}, slots: Record<string, string> = {}) {
  const tour = {
    tourType: null,
    startPoint: null,
    endPoint: null,
    startPointName: null,
    startPointElevation: null,
    endPointName: null,
    endPointElevation: null,
    seasons: null,
    description: null,
    equipment: null,
    notes: null,
    ...overrides,
  } as unknown as Tour
  return mount(TourFactRows, { props: { tour }, slots })
}

const facts = (w: ReturnType<typeof mountRows>) => w.findAll('[data-fact]').map(r => r.attributes('data-fact'))
function groups(w: ReturnType<typeof mountRows>) {
  return w.findAll('.fact-group').map(g => g.findAll('[data-fact]').map(r => r.attributes('data-fact')))
}

describe('tourFactRows', () => {
  it('should render nothing but the type row for a tour with only a type', () => {
    expect(facts(mountRows({ tourType: 'skitour' }))).toEqual(['type'])
  })

  it('should render no rows at all for a legacy tour without type', () => {
    expect(facts(mountRows())).toEqual([])
  })

  it('should show a one-way tour as such, with the one-way icon and no end elevation', () => {
    const w = mountRows({ startPoint: START, endPoint: null, endPointElevation: 999 })
    const end = w.find('[data-fact="end"]')
    expect(end.text()).toContain('oneWayToGoalIndicator')
    expect(end.text()).not.toContain('999')
    expect(end.findComponent(BaseIcon).props('name')).toBe('directions')
  })

  it('should show a round trip as such even when the end point carries a name', () => {
    const w = mountRows({ startPoint: START, endPoint: { ...START }, endPointName: 'Preda', endPointElevation: 1789 })
    const end = w.find('[data-fact="end"]')
    expect(end.text()).toContain('roundTrip')
    expect(end.text()).not.toContain('1789')
  })

  it('should fall back to coordinates for an unnamed start, without an elevation', () => {
    const w = mountRows({ startPoint: START, startPointElevation: 1500 })
    const start = w.find('[data-fact="start"]')
    expect(start.find('.coords').text()).toBe('46.6000°N, 7.9000°E')
    expect(start.text()).not.toContain('1500')
  })

  it('should label start and end visibly, but the free texts only for assistive tech', () => {
    const w = mountRows({ startPoint: START, description: 'Steep', equipment: 'Rope', notes: 'Early' })
    expect(w.find('[data-fact="start"] .row-label').text()).toBe('tours.infoSheet.startShort')
    for (const fact of ['description', 'equipment', 'notes']) {
      const row = w.find(`[data-fact="${fact}"]`)
      expect(row.find('.row-label').exists()).toBe(false)
      expect(row.find('.visually-hidden').exists()).toBe(true)
    }
  })

  it('should leave out empty groups, even when only seasons or only the GPX download fill one', () => {
    const w = mountRows({ seasons: ['winter'], notes: 'Early' }, { route: '<button>GPX</button>' })
    expect(groups(w)).toEqual([['seasons'], ['track'], ['notes']])
  })

  it('should render the partners row only when partners are slotted in', () => {
    expect(facts(mountRows({ tourType: 'hiking' }))).not.toContain('partners')
    expect(facts(mountRows({}, { partners: '<span>Anna</span>' }))).toEqual(['partners'])
  })

  it('should link URLs in the description without letting the page be reached back', () => {
    const w = mountRows({ description: 'See https://slf.ch/bulletin first' })
    const link = w.find('[data-fact="description"] a')
    expect(link.attributes('href')).toBe('https://slf.ch/bulletin')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })
})
