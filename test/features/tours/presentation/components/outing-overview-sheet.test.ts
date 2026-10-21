import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useMapStore } from '@/features/map/presentation/stores/map-store'
import OutingNavigator from '@/features/tours/presentation/components/outing-navigator.vue'
import OutingOverviewSheet from '@/features/tours/presentation/components/outing-overview-sheet.vue'
import { useToursStore } from '@/features/tours/presentation/stores/tours-store'
import { TOUR_FILL } from '../../../../fixtures/tour-fill'

vi.mock('@/core/composables/use-is-desktop', () => ({ useIsDesktop: () => ref(true) }))

function segment(id: string, position: number, userId = 'me') {
  return {
    ...TOUR_FILL,
    id,
    userId,
    name: `Segment ${id}`,
    plannedDate: null,
    goal: { lng: 7.5, lat: 46 },
    partnerIds: [],
    tourTypes: ['hiking'],
    elevation: null,
    gpxFilepath: null,
    description: null,
    seasons: null,
    startPoint: null,
    endPoint: null,
    equipment: null,
    notes: null,
    completed: false,
    isFriendTour: userId !== 'me',
    outing: { id: 'o1', name: 'Haute Route', position },
  }
}

function pinia(tours: unknown[], friendTours: unknown[] = []) {
  return createTestingPinia({
    createSpy: vi.fn,
    initialState: {
      tours: { tours, friendTours },
      auth: { currentUser: { id: 'me' } },
    },
  })
}

function mountSheet(outingKey = 'me/o1', tours = [segment('a', 0), segment('b', 1), segment('c', 2)], friendTours: unknown[] = []) {
  return mount(OutingOverviewSheet, {
    props: { outingKey },
    global: { plugins: [pinia(tours, friendTours)], stubs: { Teleport: true } },
  })
}

describe('outingOverviewSheet', () => {
  it('should list the segments in order and open one on tap', async () => {
    const wrapper = mountSheet('me/o1', [segment('c', 2), segment('a', 0), segment('b', 1)])
    const rows = wrapper.findAll('[data-testid="outing-segment"]')
    expect(rows.map(r => r.text())).toEqual([
      expect.stringContaining('Segment a'),
      expect.stringContaining('Segment b'),
      expect.stringContaining('Segment c'),
    ])
    await rows[1]!.find('button').trigger('click')
    expect(wrapper.emitted('openSegment')).toEqual([['b']])
  })

  it('should reorder by drag, remove and rename through the store in edit mode', async () => {
    const wrapper = mountSheet()
    const store = useToursStore()
    await wrapper.find('[data-testid="outing-edit"]').trigger('click')
    const rows = wrapper.findAll('[data-testid="outing-segment"]')
    await rows[0]!.trigger('dragstart')
    await rows[2]!.trigger('drop')
    expect(store.reorderSegments).toHaveBeenCalledWith(expect.any(Array), 0, 2)
    await wrapper.findAll('[data-testid="segment-remove"]')[2]!.trigger('click')
    expect(store.removeFromOuting).toHaveBeenCalledWith(expect.any(Array), 'c')
    await wrapper.find('[data-testid="outing-name-input"]').setValue('Tour du Mont Blanc')
    await wrapper.find('[data-testid="outing-done"]').trigger('click')
    expect(store.renameOuting).toHaveBeenCalledWith(expect.any(Array), 'Tour du Mont Blanc')
  })

  it('should dim the dragged card and mark the drop target until the drag ends', async () => {
    const wrapper = mountSheet()
    await wrapper.find('[data-testid="outing-edit"]').trigger('click')
    const rows = () => wrapper.findAll('[data-testid="outing-segment"]')
    await rows()[0]!.trigger('dragstart')
    await rows()[2]!.trigger('dragover')
    expect(rows().map(r => [r.classes('segment--dragging'), r.classes('segment--over')]))
      .toEqual([[true, false], [false, false], [false, true]])
    await rows()[0]!.trigger('dragend')
    expect(wrapper.findAll('.segment--dragging, .segment--over')).toHaveLength(0)
  })

  it('should flag only a segment that starts away from where the previous one finishes', () => {
    const wrapper = mountSheet('me/o1', [
      segment('a', 0),
      { ...segment('b', 1), startPoint: { lng: 7.5, lat: 46 } },
      { ...segment('c', 2), startPoint: { lng: 8, lat: 46.5 } },
    ])
    const rows = wrapper.findAll('[data-testid="outing-segment"]')
    expect(rows.map(r => r.find('[data-testid="segment-gap"]').exists())).toEqual([false, false, true])
  })

  it('should offer a new segment after the last one', async () => {
    const wrapper = mountSheet()
    await wrapper.find('[data-testid="outing-add-segment"]').trigger('click')
    await wrapper.find('[data-testid="add-segment-new"]').trigger('click')
    expect(wrapper.emitted('addSegmentNew')).toEqual([['c']])
  })

  it('should keep a friend\'s outing read-only', () => {
    const wrapper = mountSheet('friend/o1', [], [segment('a', 0, 'friend'), segment('b', 1, 'friend')])
    expect(wrapper.findAll('[data-testid="outing-segment"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="outing-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="outing-add-segment"]').exists()).toBe(false)
  })
})

describe('outingNavigator', () => {
  function mountNavigator(tourId: string, tours = [segment('a', 0), segment('b', 1), segment('c', 2)]) {
    return mount(OutingNavigator, {
      props: { tour: tours.find(t => t.id === tourId)! as never },
      global: { plugins: [pinia(tours)] },
    })
  }

  it('should step to the neighbouring segments and stop at the ends', async () => {
    const wrapper = mountNavigator('c')
    expect(wrapper.text()).toContain('tours.outing.segmentOf')
    expect(wrapper.find('[data-testid="segment-next"]').attributes('disabled')).toBeDefined()
    await wrapper.find('[data-testid="segment-prev"]').trigger('click')
    expect(useMapStore().selectTour).toHaveBeenCalledWith('b')
  })

  it('should open the overview from the outing name', async () => {
    const wrapper = mountNavigator('a')
    await wrapper.find('[data-testid="outing-overview-link"]').trigger('click')
    expect(wrapper.emitted('openOuting')).toEqual([['me/o1']])
  })

  it('should not render for a lone segment', () => {
    const wrapper = mountNavigator('a', [segment('a', 0)])
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})
