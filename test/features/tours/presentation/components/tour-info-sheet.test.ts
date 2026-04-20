import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'

// Stub heavy child components
const BottomSheetStub = {
  name: 'BottomSheet',
  template: '<div><slot /><slot name="default" /><slot name="footer" /></div>',
  props: ['title'],
  emits: ['close'],
}
const SideDrawerStub = {
  name: 'SideDrawer',
  template: '<div><slot /><slot name="default" /><slot name="footer" /></div>',
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
  props: ['contact', 'selected', 'mode'],
  emits: ['open', 'toggle'],
}

const ContactActionMenuStub = {
  name: 'ContactActionMenu',
  template: '<div data-testid="contact-action-menu" />',
  props: ['contact', 'anchorRect'],
  emits: ['close', 'editContact'],
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
  completed: false,
}

function mountSheet(tourOverrides = {}, authUserId = 'user-1', initialContacts: unknown[] = []) {
  return mount(TourInfoSheet, {
    props: { tour: { ...mockTour, ...tourOverrides } },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            contacts: { contacts: initialContacts },
            tours: { tours: [mockTour] },
            auth: { currentUser: { id: authUserId }, isAuthenticated: true },
          },
        }),
      ],
      stubs: {
        BottomSheet: BottomSheetStub,
        SideDrawer: SideDrawerStub,
        TourForm: TourFormStub,
        ContactChip: ContactChipStub,
        ContactActionMenu: ContactActionMenuStub,
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

      await wrapper.find('[data-testid="edit-btn"]').trigger('click')

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(true)
    })

    it('should return to view mode when form cancel is triggered', async () => {
      const wrapper = mountSheet()

      // Enter edit mode
      await wrapper.find('[data-testid="edit-btn"]').trigger('click')

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
      await wrapper.find('[data-testid="edit-btn"]').trigger('click')

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

      await wrapper.find('[data-testid="edit-btn"]').trigger('click')

      await wrapper.find('[data-testid="stub-submit"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(true)
      expect(wrapper.find('.save-error').text()).toBe('RPC failed')
    })
  })

  // ── Completion toggle ──────────────────────────────────────────────────────

  describe('completion toggle', () => {
    it('should show completion toggle for tour owner', async () => {
      const wrapper = mountSheet()
      expect(wrapper.find('.completion-toggle').exists()).toBe(true)
    })

    it('should not show completion toggle for non-owner', async () => {
      const wrapper = mountSheet({}, 'other-user')
      expect(wrapper.find('.completion-toggle').exists()).toBe(false)
    })

    it('should call setCompleted with true when not completed', async () => {
      const wrapper = mountSheet({ completed: false })
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()

      await wrapper.find('.completion-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.setCompleted).toHaveBeenCalledWith('tour-1', true)
    })

    it('should call setCompleted with false when already completed', async () => {
      const wrapper = mountSheet({ completed: true })
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()

      await wrapper.find('.completion-toggle').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.setCompleted).toHaveBeenCalledWith('tour-1', false)
    })

    it('should show check_circle icon when completed', () => {
      const wrapper = mountSheet({ completed: true })
      const icon = wrapper.find('.completion-toggle .material-symbols-outlined')
      expect(icon.text()).toBe('check_circle')
    })

    it('should show radio_button_unchecked icon when not completed', () => {
      const wrapper = mountSheet({ completed: false })
      const icon = wrapper.find('.completion-toggle .material-symbols-outlined')
      expect(icon.text()).toBe('radio_button_unchecked')
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

  // ── Partners section ───────────────────────────────────────────────────────

  const mockContact = {
    id: 'contact-1',
    userId: 'user-1',
    firstName: 'Anna',
    lastName: null,
    displayName: null,
    contactMethods: [],
  }

  describe('partners section', () => {
    it('renders chips in action mode', () => {
      const wrapper = mountSheet({ partnerIds: ['contact-1'] }, 'user-1', [mockContact])
      const chip = wrapper.findComponent(ContactChipStub)
      expect(chip.exists()).toBe(true)
      expect(chip.props('mode')).toBe('action')
    })

    it('does not show group-sms-btn for single partner', () => {
      const wrapper = mountSheet({ partnerIds: ['contact-1'] }, 'user-1', [mockContact])
      expect(wrapper.find('[data-testid="group-sms-btn"]').exists()).toBe(false)
    })

    it('shows group-sms-btn for multiple partners', () => {
      const contact2 = { ...mockContact, id: 'contact-2' }
      const wrapper = mountSheet({ partnerIds: ['contact-1', 'contact-2'] }, 'user-1', [
        mockContact,
        contact2,
      ])
      expect(wrapper.find('[data-testid="group-sms-btn"]').exists()).toBe(true)
    })

    it('does not render ContactActionMenu when no chip is active', () => {
      const wrapper = mountSheet({ partnerIds: ['contact-1'] }, 'user-1', [mockContact])
      expect(wrapper.find('[data-testid="contact-action-menu"]').exists()).toBe(false)
    })
  })
})
