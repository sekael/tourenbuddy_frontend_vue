import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MapActionOverlay from '@/features/map/presentation/components/map-action-overlay.vue'

function mountOverlay(
  options: {
    isPickingLocation?: boolean
    incomingRequests?: Array<{ id: string, status: string }>
    bearing?: number
    overlayActive?: boolean
  } = {},
) {
  return mount(MapActionOverlay, {
    props: {
      bearing: options.bearing ?? 0,
      overlayActive: options.overlayActive ?? false,
    },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          stubActions: false,
          initialState: {
            map: { isPickingLocation: options.isPickingLocation ?? false, currentStyleIndex: 0 },
            friendships: { incomingRequests: options.incomingRequests ?? [] },
          },
        }),
      ],
    },
    attachTo: document.body,
  })
}

describe('mapActionOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('collapsed state', () => {
    it('should show trigger and hide menu when closed', () => {
      const wrapper = mountOverlay()
      expect(wrapper.find('[aria-haspopup="menu"]').exists()).toBe(true)
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })

    it('should not render compass when bearing is zero', () => {
      const wrapper = mountOverlay({ bearing: 0 })
      expect(wrapper.find('.compass-fab').exists()).toBe(false)
    })

    it('should render compass when bearing is non-zero', () => {
      const wrapper = mountOverlay({ bearing: 45 })
      expect(wrapper.find('.compass-fab').exists()).toBe(true)
    })

    it('should emit resetBearing when compass clicked', async () => {
      const wrapper = mountOverlay({ bearing: 45 })
      await wrapper.find('.compass-fab').trigger('click')
      expect(wrapper.emitted('resetBearing')).toHaveLength(1)
    })
  })

  describe('trigger toggle', () => {
    it('should open menu when trigger is clicked', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      expect(wrapper.find('[role="menu"]').exists()).toBe(true)
    })

    it('should close menu when trigger is clicked again', async () => {
      const wrapper = mountOverlay()
      const trigger = wrapper.find('[aria-haspopup="menu"]')
      await trigger.trigger('click')
      await trigger.trigger('click')
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })
  })

  describe('aRIA attributes', () => {
    it('should set aria-expanded=false when closed', () => {
      const wrapper = mountOverlay()
      const trigger = wrapper.find('[aria-haspopup="menu"]')
      expect(trigger.attributes('aria-expanded')).toBe('false')
    })

    it('should set aria-expanded=true when menu open', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const trigger = wrapper.find('[aria-haspopup="menu"]')
      expect(trigger.attributes('aria-expanded')).toBe('true')
    })

    it('should have aria-controls pointing to speed-dial-menu', () => {
      const wrapper = mountOverlay()
      expect(wrapper.find('[aria-controls="speed-dial-menu"]').exists()).toBe(true)
    })
  })

  describe('trigger icon', () => {
    it('should render menu glyph when collapsed', () => {
      const wrapper = mountOverlay()
      const icon = wrapper.find('.material-symbols-outlined')
      expect(icon.text()).toBe('menu')
    })

    it('should render menu glyph (no swap) when expanded', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const fabButton = wrapper.find('.fab')
      expect(fabButton.find('.material-symbols-outlined').text()).toBe('menu')
    })

    it('should apply open class to trigger when menu is open', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      expect(wrapper.find('.fab.open').exists()).toBe(true)
    })
  })

  describe('eSC and outside click', () => {
    it('should close menu on ESC key', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      expect(wrapper.find('[role="menu"]').exists()).toBe(true)
      await wrapper.find('.overlay').trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })

    it('should close menu when backdrop is clicked', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      await wrapper.find('.backdrop').trigger('click')
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })
  })

  describe('isPickingLocation', () => {
    it('should hide entire overlay when isPickingLocation is true', () => {
      const wrapper = mountOverlay({ isPickingLocation: true })
      expect(wrapper.find('.overlay').exists()).toBe(false)
    })
  })

  describe('menu contents', () => {
    it('should not contain tours entry in speed dial', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const buttons = wrapper.findAll('[role="menuitem"]')
      const toursBtn = buttons.find(b => b.text().includes('map.overlay.tours'))
      expect(toursBtn).toBeUndefined()
    })

    it('should not contain add-tour entry in speed dial', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const buttons = wrapper.findAll('[role="menuitem"]')
      const addTourBtn = buttons.find(b => b.text().includes('map.overlay.addTour'))
      expect(addTourBtn).toBeUndefined()
    })
  })

  describe('badge bubble-up', () => {
    it('should show trigger dot when pendingIncomingCount > 0 and menu closed', () => {
      const wrapper = mountOverlay({
        incomingRequests: [{ id: '1', status: 'pending' }],
      })
      expect(wrapper.find('.dot').exists()).toBe(true)
    })

    it('should not show trigger dot when no pending requests', () => {
      const wrapper = mountOverlay({ incomingRequests: [] })
      expect(wrapper.find('.dot').exists()).toBe(false)
    })

    it('should hide trigger dot while menu is open', async () => {
      const wrapper = mountOverlay({
        incomingRequests: [{ id: '1', status: 'pending' }],
      })
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      expect(wrapper.find('.dot').exists()).toBe(false)
    })

    it('should show badge on contacts menu item when menu open', async () => {
      const wrapper = mountOverlay({
        incomingRequests: [{ id: '1', status: 'pending' }],
      })
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      expect(wrapper.find('.badge').exists()).toBe(true)
      expect(wrapper.find('.badge').text()).toBe('1')
    })
  })

  describe('menu item events', () => {
    it('should emit openContacts and close menu when contacts item clicked', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const buttons = wrapper.findAll('[role="menuitem"]')
      const contactsBtn = buttons.find(b => b.text().includes('map.overlay.contacts'))
      await contactsBtn?.trigger('click')
      expect(wrapper.emitted('openContacts')).toHaveLength(1)
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })

    it('should emit openProfile and close menu when profile item clicked', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const buttons = wrapper.findAll('[role="menuitem"]')
      const profileBtn = buttons.find(b => b.text().includes('map.overlay.profile'))
      await profileBtn?.trigger('click')
      expect(wrapper.emitted('openProfile')).toHaveLength(1)
    })

    it('should emit openFeedback and close menu when feedback item clicked', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const buttons = wrapper.findAll('[role="menuitem"]')
      const feedbackBtn = buttons.find(b => b.text().includes('map.overlay.feedback'))
      await feedbackBtn?.trigger('click')
      expect(wrapper.emitted('openFeedback')).toHaveLength(1)
    })
  })

  describe('overlayActive', () => {
    it('should emit dismissOverlay and not open menu when overlay is active', async () => {
      const wrapper = mountOverlay({ overlayActive: true })
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      expect(wrapper.emitted('dismissOverlay')).toHaveLength(1)
      expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    })

    it('should apply disabled class to trigger when overlay is active', () => {
      const wrapper = mountOverlay({ overlayActive: true })
      expect(wrapper.find('.trigger--overlay-active').exists()).toBe(true)
    })
  })

  describe('menu-item layout', () => {
    it('should have label-chip before icon-fab in DOM order', async () => {
      const wrapper = mountOverlay()
      await wrapper.find('[aria-haspopup="menu"]').trigger('click')
      const firstItem = wrapper.find('[role="menuitem"]')
      const children = firstItem.element.children
      expect(children[0]!.classList.contains('label-chip')).toBe(true)
      expect(children[1]!.classList.contains('icon-fab')).toBe(true)
    })
  })
})
