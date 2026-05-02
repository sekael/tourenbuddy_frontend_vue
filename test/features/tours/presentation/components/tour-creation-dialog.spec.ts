import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import TourCreationDialog from '@/features/tours/presentation/components/tour-creation-dialog.vue'

const AdaptiveOverlayStub = {
  name: 'AdaptiveOverlay',
  template:
    '<div :data-collapsed="collapsed ? \'true\' : \'false\'" :data-title="title"><slot /></div>',
  props: ['title', 'collapsed', 'ariaLabel'],
  emits: ['close'],
}
const TourFormStub = {
  name: 'TourForm',
  template:
    '<div data-testid="tour-form" :data-disabled="disabled ? \'true\' : \'false\'"><button data-testid="stub-submit" @click="$emit(\'submit\', stubDraft)">Save</button></div>',
  props: [
    'submitLabel',
    'allowGoalEdit',
    'currentGoal',
    'initialElevation',
    'initialName',
    'initialStartPoint',
    'initialEndPoint',
    'disabled',
  ],
  emits: ['submit', 'cancel', 'pickPoint'],
  setup() {
    return { stubDraft: { name: 'Draft' } }
  },
}

function mountDialog(mapState: Record<string, unknown> = {}) {
  return mount(TourCreationDialog, {
    props: { initialGoal: { lng: 8.2, lat: 46.8 } },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: { map: { isPickingLocation: false, ...mapState } },
        }),
      ],
      stubs: { AdaptiveOverlay: AdaptiveOverlayStub, TourForm: TourFormStub },
    },
  })
}

describe('tourCreationDialog', () => {
  it('collapses overlay and disables form while location picker is active', () => {
    const wrapper = mountDialog({ isPickingLocation: true })
    expect(wrapper.element.getAttribute('data-collapsed')).toBe('true')
    expect(wrapper.find('[data-testid="tour-form"]').attributes('data-disabled')).toBe('true')
  })

  it('does not emit confirm while picker is active', async () => {
    const wrapper = mountDialog({ isPickingLocation: true })
    await wrapper.find('[data-testid="stub-submit"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits confirm normally when picker is inactive', async () => {
    const wrapper = mountDialog({ isPickingLocation: false })
    await wrapper.find('[data-testid="stub-submit"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('forwards pickPoint: goal when TourForm emits it', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent({ name: 'TourForm' }).vm.$emit('pickPoint', 'goal')
    expect(wrapper.emitted('pickPoint')).toEqual([['goal']])
  })

  it('forwards pickPoint: start when TourForm emits it', async () => {
    const wrapper = mountDialog()
    await wrapper.findComponent({ name: 'TourForm' }).vm.$emit('pickPoint', 'start')
    expect(wrapper.emitted('pickPoint')).toEqual([['start']])
  })

  describe('collapsed header label per activePickType', () => {
    it('shows "Tour Goal" label when picker is active with goal type', () => {
      const wrapper = mount(TourCreationDialog, {
        props: { initialGoal: { lng: 8.2, lat: 46.8 }, activePickType: 'goal' },
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: { map: { isPickingLocation: true } },
            }),
          ],
          stubs: { AdaptiveOverlay: AdaptiveOverlayStub, TourForm: TourFormStub },
        },
      })
      expect(wrapper.element.getAttribute('data-title')).toContain('Tour Goal')
    })

    it('shows "Start Point" label when picker is active with start type', () => {
      const wrapper = mount(TourCreationDialog, {
        props: { initialGoal: { lng: 8.2, lat: 46.8 }, activePickType: 'start' },
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: { map: { isPickingLocation: true } },
            }),
          ],
          stubs: { AdaptiveOverlay: AdaptiveOverlayStub, TourForm: TourFormStub },
        },
      })
      expect(wrapper.element.getAttribute('data-title')).toContain('Start Point')
    })

    it('shows "End Point" label when picker is active with end type', () => {
      const wrapper = mount(TourCreationDialog, {
        props: { initialGoal: { lng: 8.2, lat: 46.8 }, activePickType: 'end' },
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: { map: { isPickingLocation: true } },
            }),
          ],
          stubs: { AdaptiveOverlay: AdaptiveOverlayStub, TourForm: TourFormStub },
        },
      })
      expect(wrapper.element.getAttribute('data-title')).toContain('End Point')
    })
  })
})
