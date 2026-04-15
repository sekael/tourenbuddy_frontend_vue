import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'

// Stub heavy child components
const BottomSheetStub = {
  name: 'BottomSheet',
  template: '<div><slot /><slot name="default" /></div>',
  props: ['title'],
  emits: ['close'],
}
const SideDrawerStub = {
  name: 'SideDrawer',
  template: '<div><slot /><slot name="default" /></div>',
  props: ['title'],
  emits: ['close'],
}
const TourFormStub = {
  name: 'TourForm',
  template:
    '<div data-testid="tour-form"><button data-testid="stub-submit" @click="$emit(\'submit\', stubDraft)">Save</button><button data-testid="stub-cancel" @click="$emit(\'cancel\')">Cancel</button></div>',
  props: [
    'submitLabel',
    'allowGoalEdit',
    'currentGoal',
    'initialDraft',
    'initialStartPoint',
    'initialEndPoint',
  ],
  emits: ['submit', 'cancel', 'pickPoint'],
  setup() {
    const stubDraft = {
      name: 'Edited Tour',
      plannedDate: null,
      partnerIds: [],
      tourType: null,
      elevation: null,
      gpxTrack: null,
      description: null,
      seasons: null,
      startPoint: null,
      endPoint: null,
      equipment: null,
      notes: null,
    }
    return { stubDraft }
  },
}
const ContactChipStub = {
  name: 'ContactChip',
  template: '<div />',
  props: ['contact', 'selected', 'showActions'],
}

const mockTour = {
  id: 'tour-1',
  userId: 'user-1',
  name: 'Rigi Tour',
  plannedDate: null,
  goal: { lng: 8.2, lat: 46.8 },
  partnerIds: [],
  tourType: null,
  elevation: null,
  gpxTrack: null,
  description: null,
  seasons: null,
  startPoint: null,
  endPoint: null,
  equipment: null,
  notes: null,
}

function mountSheet(tourOverrides = {}) {
  return mount(TourInfoSheet, {
    props: { tour: { ...mockTour, ...tourOverrides } },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            contacts: { contacts: [] },
            tours: { tours: [mockTour] },
          },
        }),
      ],
      stubs: {
        BottomSheet: BottomSheetStub,
        SideDrawer: SideDrawerStub,
        TourForm: TourFormStub,
        ContactChip: ContactChipStub,
      },
    },
  })
}

describe('tourInfoSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Edit mode ──────────────────────────────────────────────────────────────

  describe('edit mode', () => {
    it('should show TourForm and hide detail view when edit is clicked', async () => {
      const wrapper = mountSheet()

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(false)

      await wrapper
        .find('button[aria-label="edit"], button.action-btn:first-child')
        .trigger('click')

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(true)
    })

    it('should return to view mode when form cancel is triggered', async () => {
      const wrapper = mountSheet()

      // Enter edit mode
      const editBtn = wrapper.findAll('.action-btn')[0]
      await editBtn?.trigger('click')

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(true)

      // Cancel
      await wrapper.find('[data-testid="stub-cancel"]').trigger('click')

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(false)
    })

    it('should call updateTour and return to view mode on successful save', async () => {
      const wrapper = mountSheet()
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()
      vi.mocked(store.updateTour).mockResolvedValue(undefined)

      // Enter edit
      const editBtn = wrapper.findAll('.action-btn')[0]
      await editBtn?.trigger('click')

      // Submit via stub
      await wrapper.find('[data-testid="stub-submit"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.updateTour).toHaveBeenCalledWith(
        'tour-1',
        expect.objectContaining({ name: 'Edited Tour' }),
        { lng: 8.2, lat: 46.8 },
      )
      // Back to view mode
      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(false)
    })

    it('should show inline error and stay in edit mode when updateTour throws', async () => {
      const wrapper = mountSheet()
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()
      vi.mocked(store.updateTour).mockRejectedValue(new Error('RPC failed'))

      const editBtn = wrapper.findAll('.action-btn')[0]
      await editBtn?.trigger('click')

      await wrapper.find('[data-testid="stub-submit"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(true)
      expect(wrapper.find('.save-error').text()).toBe('RPC failed')
    })
  })

  // ── Delete flow ────────────────────────────────────────────────────────────

  describe('delete flow', () => {
    it('should show confirmation when delete button is clicked', async () => {
      const wrapper = mountSheet()

      const deleteBtn = wrapper.find('.action-btn--danger')
      await deleteBtn.trigger('click')

      expect(wrapper.find('.delete-confirm-text').exists()).toBe(true)
    })

    it('should return to idle when cancel is clicked on confirm prompt', async () => {
      const wrapper = mountSheet()

      await wrapper.find('.action-btn--danger').trigger('click')
      expect(wrapper.find('.delete-confirm-text').exists()).toBe(true)

      await wrapper.find('.cancel-btn').trigger('click')

      expect(wrapper.find('.delete-confirm-text').exists()).toBe(false)
      expect(wrapper.find('.action-btn--danger').exists()).toBe(true)
    })

    it('should call deleteTour and emit close on successful delete', async () => {
      const wrapper = mountSheet()
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()
      vi.mocked(store.deleteTour).mockResolvedValue(undefined)

      await wrapper.find('.action-btn--danger').trigger('click')
      await wrapper.find('.delete-confirm-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.deleteTour).toHaveBeenCalledWith('tour-1')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('should show error and not emit close when deleteTour throws', async () => {
      const wrapper = mountSheet()
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()
      vi.mocked(store.deleteTour).mockRejectedValue(new Error('Delete failed'))

      await wrapper.find('.action-btn--danger').trigger('click')
      await wrapper.find('.delete-confirm-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
      expect(wrapper.find('.delete-error').text()).toBe('Delete failed')
    })
  })
})
