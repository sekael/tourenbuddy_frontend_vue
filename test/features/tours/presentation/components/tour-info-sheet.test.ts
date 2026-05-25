import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useContactsStore } from '@/features/contacts/presentation/stores/contacts-store'
import TourInfoSheet from '@/features/tours/presentation/components/tour-info-sheet.vue'

const mockDownloadOriginal = vi.fn()

vi.mock('@/features/tours/data/services/gpx-storage-service', () => ({
  downloadOriginal: (...args: unknown[]) => mockDownloadOriginal(...args),
  uploadGpx: vi.fn(),
  removeGpx: vi.fn(),
  getSignedUrl: vi.fn(),
}))

// Stub heavy child components
const BottomSheetStub = {
  name: 'BottomSheet',
  template:
    '<div :data-collapsed="collapsed ? \'true\' : \'false\'" :data-title="title"><slot /><slot name="default" /><slot name="footer" /></div>',
  props: ['title', 'collapsed'],
  emits: ['close'],
}
const SideDrawerStub = {
  name: 'SideDrawer',
  template:
    '<div :data-collapsed="collapsed ? \'true\' : \'false\'" :data-title="title"><slot /><slot name="default" /><slot name="footer" /></div>',
  props: ['title', 'collapsed'],
  emits: ['close'],
}
const TourFormStub = {
  name: 'TourForm',
  template:
    '<div data-testid="tour-form" :data-disabled="disabled ? \'true\' : \'false\'"><button data-testid="stub-submit" @click="$emit(\'submit\', stubDraft, null, false)">Save</button><button data-testid="stub-cancel" @click="$emit(\'cancel\')">Cancel</button></div>',
  props: [
    'submitLabel',
    'allowGoalEdit',
    'currentGoal',
    'initialDraft',
    'initialStartPoint',
    'initialEndPoint',
    'disabled',
  ],
  emits: ['submit', 'cancel', 'pickPoint'],
  setup() {
    const stubDraft = {
      name: 'Edited Tour',
      plannedDate: null,
      partnerIds: [],
      tourType: null,
      elevation: null,
      gpxFilepath: null,
      description: null,
      seasons: null,
      startPoint: null,
      endPoint: null,
      startPointName: null,
      startPointElevation: null,
      endPointName: null,
      endPointElevation: null,
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
  gpxFilepath: null,
  description: null,
  seasons: null,
  startPoint: null,
  endPoint: null,
  startPointName: null,
  startPointElevation: null,
  endPointName: null,
  endPointElevation: null,
  equipment: null,
  notes: null,
  completed: false,
}

function mountSheet(
  tourOverrides = {},
  authUserId = 'user-1',
  initialContacts: unknown[] = [],
  mapState: Record<string, unknown> = {},
) {
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
            map: { isPickingLocation: false, ...mapState },
          },
        }),
      ],
      stubs: {
        BottomSheet: BottomSheetStub,
        SideDrawer: SideDrawerStub,
        TourForm: TourFormStub,
        ContactChip: ContactChipStub,
        ContactActionMenu: ContactActionMenuStub,
        TourAttachmentsStrip: { template: '<div />' },
        TourAttachmentViewer: { template: '<div />' },
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
        false,
      )
      // Back to view mode
      expect(wrapper.find('[data-testid="tour-form"]').exists()).toBe(false)
    })

    it('should collapse sheet and disable form while location picker is active', async () => {
      const wrapper = mountSheet({}, 'user-1', [], { isPickingLocation: true })
      await wrapper.find('[data-testid="edit-btn"]').trigger('click')

      const sheet = wrapper.find('[data-testid="tour-form"]').element.parentElement as HTMLElement
      // stubbed root of BottomSheet/SideDrawer
      const root = wrapper.element as HTMLElement
      expect(root.getAttribute('data-collapsed')).toBe('true')
      // collapsed title now shows pick-type label (defaults to goalTitle key when no activePickType)
      expect(root.getAttribute('data-title')).toContain('goalTitle')
      expect(wrapper.find('[data-testid="tour-form"]').attributes('data-disabled')).toBe('true')
      expect(sheet).toBeDefined()
    })

    it('should not call updateTour when edit submit fires while picker is active', async () => {
      const wrapper = mountSheet({}, 'user-1', [], { isPickingLocation: true })
      const { useToursStore } = await import('@/features/tours/presentation/stores/tours-store')
      const store = useToursStore()

      await wrapper.find('[data-testid="edit-btn"]').trigger('click')
      await wrapper.find('[data-testid="stub-submit"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.updateTour).not.toHaveBeenCalled()
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

  // ── Pick-type label in collapsed header ───────────────────────────────────

  describe('collapsed header label per activePickType', () => {
    function mountSheetWithPick(activePickType: 'goal' | 'start' | 'end') {
      return mount(TourInfoSheet, {
        props: {
          tour: { ...mockTour },
          activePickType,
        },
        global: {
          plugins: [
            createTestingPinia({
              createSpy: vi.fn,
              initialState: {
                contacts: { contacts: [] },
                tours: { tours: [mockTour] },
                auth: { currentUser: { id: 'user-1' }, isAuthenticated: true },
                map: { isPickingLocation: true },
              },
            }),
          ],
          stubs: {
            BottomSheet: BottomSheetStub,
            SideDrawer: SideDrawerStub,
            TourForm: TourFormStub,
            ContactChip: ContactChipStub,
            ContactActionMenu: ContactActionMenuStub,
            TourAttachmentsStrip: { template: '<div />' },
            TourAttachmentViewer: { template: '<div />' },
          },
        },
      })
    }

    it('shows goalTitle when activePickType is goal during edit pick', async () => {
      const wrapper = mountSheetWithPick('goal')
      await wrapper.find('[data-testid="edit-btn"]').trigger('click')
      expect((wrapper.element as HTMLElement).getAttribute('data-title')).toContain('goalTitle')
    })

    it('shows startTitle when activePickType is start during edit pick', async () => {
      const wrapper = mountSheetWithPick('start')
      await wrapper.find('[data-testid="edit-btn"]').trigger('click')
      expect((wrapper.element as HTMLElement).getAttribute('data-title')).toContain('startTitle')
    })

    it('shows endTitle when activePickType is end during edit pick', async () => {
      const wrapper = mountSheetWithPick('end')
      await wrapper.find('[data-testid="edit-btn"]').trigger('click')
      expect((wrapper.element as HTMLElement).getAttribute('data-title')).toContain('endTitle')
    })
  })

  // ── Start/end metadata and one-way indicator ───────────────────────────────

  describe('start/end point metadata display', () => {
    it('renders startPointName and startPointElevation when present', () => {
      const wrapper = mountSheet({
        startPoint: { lng: 8.0, lat: 46.5 },
        startPointName: 'Grindelwald',
        startPointElevation: 1034,
      })
      expect(wrapper.text()).toContain('Grindelwald')
      expect(wrapper.text()).toContain('1034')
    })

    it('renders "One-way to goal" indicator when start is set and end is null', () => {
      const wrapper = mountSheet({
        startPoint: { lng: 8.0, lat: 46.5 },
        endPoint: null,
      })
      expect(wrapper.text()).toContain('oneWayToGoalIndicator')
    })

    it('does not render one-way indicator when both start and end are set', () => {
      const wrapper = mountSheet({
        startPoint: { lng: 8.0, lat: 46.5 },
        endPoint: { lng: 8.1, lat: 46.6 },
      })
      expect(wrapper.text()).not.toContain('oneWayToGoalIndicator')
    })

    it('renders endPointName when end is set and name is present', () => {
      const wrapper = mountSheet({
        startPoint: { lng: 8.0, lat: 46.5 },
        endPoint: { lng: 8.1, lat: 46.6 },
        endPointName: 'Kleine Scheidegg',
        endPointElevation: 2061,
      })
      expect(wrapper.text()).toContain('Kleine Scheidegg')
      expect(wrapper.text()).toContain('2061')
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

    it('should update partner chip contact prop when contact is renamed via contacts store', async () => {
      const wrapper = mountSheet({ partnerIds: ['contact-1'] }, 'user-1', [mockContact])
      const contactsStore = useContactsStore()

      contactsStore.contacts = [{ ...mockContact, firstName: 'Updated' }]
      await nextTick()

      const chip = wrapper.findComponent(ContactChipStub)
      expect((chip.props('contact') as typeof mockContact).firstName).toBe('Updated')
    })

    it('should reflect updated primary phone in action menu when setPrimaryPhoneOnContact is called', async () => {
      const contactWithPhone = {
        ...mockContact,
        contactMethods: [
          {
            id: 'method-1',
            contactId: 'contact-1',
            methodType: 'phone' as const,
            value: '+41791111111',
            label: null,
            isPrimary: true,
          },
          {
            id: 'method-2',
            contactId: 'contact-1',
            methodType: 'phone' as const,
            value: '+41792222222',
            label: null,
            isPrimary: false,
          },
        ],
      }
      const wrapper = mountSheet({ partnerIds: ['contact-1'] }, 'user-1', [contactWithPhone])
      const contactsStore = useContactsStore()

      const chip = wrapper.findComponent(ContactChipStub)
      chip.vm.$emit('open', 'contact-1', new DOMRect(0, 0, 100, 50))
      await nextTick()

      expect(wrapper.find('[data-testid="contact-action-menu"]').exists()).toBe(true)

      const updatedContact = {
        ...contactWithPhone,
        contactMethods: [
          {
            id: 'method-1',
            contactId: 'contact-1',
            methodType: 'phone' as const,
            value: '+41791111111',
            label: null,
            isPrimary: false,
          },
          {
            id: 'method-2',
            contactId: 'contact-1',
            methodType: 'phone' as const,
            value: '+41792222222',
            label: null,
            isPrimary: true,
          },
        ],
      }
      contactsStore.contacts = [updatedContact]
      await nextTick()

      const menu = wrapper.findComponent(ContactActionMenuStub)
      const menuContact = menu.props('contact') as typeof updatedContact
      expect(menuContact.contactMethods.find(m => m.isPrimary)?.id).toBe('method-2')
    })
  })

  describe('gPX download button', () => {
    it('should not show download button when gpxFilepath is null', () => {
      const wrapper = mountSheet({ gpxFilepath: null })
      const btn = wrapper.find('.gpx-download-btn')
      expect(btn.exists()).toBe(false)
    })

    it('should show download button when gpxFilepath is set', () => {
      const wrapper = mountSheet({ gpxFilepath: 'tour-abc.gpx' })
      const btn = wrapper.find('.gpx-download-btn')
      expect(btn.exists()).toBe(true)
    })

    it('should call downloadOriginal when download button is clicked', async () => {
      mockDownloadOriginal.mockResolvedValue(undefined)
      const wrapper = mountSheet({ gpxFilepath: 'tour-abc.gpx', name: 'My Tour' })
      const btn = wrapper.find('.gpx-download-btn')
      await btn.trigger('click')
      await nextTick()
      expect(mockDownloadOriginal).toHaveBeenCalledWith('tour-abc.gpx', 'My Tour.gpx')
    })

    it('should not throw when downloadOriginal fails', async () => {
      mockDownloadOriginal.mockRejectedValue(new Error('network error'))
      const wrapper = mountSheet({ gpxFilepath: 'tour-abc.gpx' })
      const btn = wrapper.find('.gpx-download-btn')
      await expect(btn.trigger('click')).resolves.not.toThrow()
    })
  })
})
