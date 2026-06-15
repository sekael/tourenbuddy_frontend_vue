import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import BottomSheet from '@/core/components/bottom-sheet.vue'

// happy-dom stubs for APIs not supported in test env
beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { value: 1000, writable: true, configurable: true })
  // Default: no keyboard. Individual tests override with a scriptable viewport.
  Object.defineProperty(window, 'visualViewport', {
    value: undefined,
    writable: true,
    configurable: true,
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  // @ts-expect-error stubbing browser API for tests
  HTMLElement.prototype.setPointerCapture = vi.fn()
  // @ts-expect-error stubbing browser API for tests
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

function firePointer(el: Element, type: string, clientY: number, pointerId = 1) {
  el.dispatchEvent(new PointerEvent(type, { clientY, pointerId, bubbles: true, cancelable: true }))
}

describe('bottomSheet', () => {
  it('should render the title when provided', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'My Sheet' } })
    expect(wrapper.find('h2').text()).toBe('My Sheet')
  })

  it('should not render an h2 when no title is provided', () => {
    const wrapper = mount(BottomSheet, { props: { ariaLabel: 'Sheet' } })
    expect(wrapper.find('h2').exists()).toBe(false)
  })

  it('should render the default slot content', () => {
    const wrapper = mount(BottomSheet, {
      props: { title: 'Test' },
      slots: { default: '<p class="slot-content">Hello</p>' },
    })
    expect(wrapper.find('.slot-content').exists()).toBe(true)
    expect(wrapper.find('.slot-content').text()).toBe('Hello')
  })

  it('should emit close when the close button is clicked', async () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    await wrapper.find('.close-btn').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should have role="dialog" and aria-modal="true"', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    const sheet = wrapper.find('.bottom-sheet')
    expect(sheet.attributes('role')).toBe('dialog')
    expect(sheet.attributes('aria-modal')).toBe('true')
  })

  it('should link aria-labelledby to title when title is provided', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Labeled' } })
    const sheet = wrapper.find('.bottom-sheet')
    expect(sheet.attributes('aria-labelledby')).toBe('bottom-sheet-title')
    expect(wrapper.find('#bottom-sheet-title').exists()).toBe(true)
  })

  it('should use aria-label fallback when no title is provided', () => {
    const wrapper = mount(BottomSheet, { props: { ariaLabel: 'Custom label' } })
    const sheet = wrapper.find('.bottom-sheet')
    expect(sheet.attributes('aria-label')).toBe('Custom label')
    expect(sheet.attributes('aria-labelledby')).toBeUndefined()
  })

  it('should have the close button with an aria-label', () => {
    const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
    expect(wrapper.find('.close-btn').attributes('aria-label')).toBe('core.drawer.close')
  })

  describe('collapsed mode', () => {
    it('should hide close button, drag handle, and footer when collapsed', () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: true },
        slots: { footer: '<div class="slot-footer">f</div>' },
      })
      expect(wrapper.find('.close-btn').exists()).toBe(false)
      expect(wrapper.find('.drag-handle').exists()).toBe(false)
      expect(wrapper.find('.footer').attributes('style')).toContain('display: none')
    })

    it('should keep default slot mounted but hidden when collapsed', () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: true },
        slots: { default: '<p class="slot-content">Preserved</p>' },
      })
      expect(wrapper.find('.slot-content').exists()).toBe(true)
      expect(wrapper.find('.content').attributes('style')).toContain('display: none')
    })

    it('should preserve slot state across collapsed toggle', async () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: false },
        slots: { default: '<input class="slot-input" />' },
      })
      const input = wrapper.find('.slot-input').element as HTMLInputElement
      input.value = 'typed'
      await wrapper.setProps({ collapsed: true })
      // Same DOM node preserved → value retained
      const afterCollapse = wrapper.find('.slot-input').element as HTMLInputElement
      expect(afterCollapse).toBe(input)
      expect(afterCollapse.value).toBe('typed')
      await wrapper.setProps({ collapsed: false })
      expect((wrapper.find('.slot-input').element as HTMLInputElement).value).toBe('typed')
    })

    it('should hide back button when collapsed', () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test', collapsed: true, showBack: true },
      })
      expect(wrapper.find('.back-btn').exists()).toBe(false)
    })
  })

  describe('drag handle', () => {
    it('should render drag handle with correct a11y attributes', () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      const handle = wrapper.find('.drag-handle')
      expect(handle.exists()).toBe(true)
      expect(handle.attributes('role')).toBe('separator')
      expect(handle.attributes('aria-orientation')).toBe('horizontal')
      expect(handle.attributes('tabindex')).toBe('0')
      expect(handle.attributes('aria-valuemin')).toBe('0')
      expect(handle.attributes('aria-valuemax')).toBe('2')
    })

    it('should not render drag handle when collapsed', () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test', collapsed: true } })
      expect(wrapper.find('.drag-handle').exists()).toBe(false)
    })

    it('should not start drag when collapsed prop is true', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test', collapsed: true } })
      // collapsed → no handle → no drag possible; inline height style should be empty
      const style = wrapper.find('.bottom-sheet').attributes('style') ?? ''
      expect(style).not.toContain('height')
    })
  })

  describe('drag resize', () => {
    it('should set height to expanded snap on mount (natural height unmeasurable in test env)', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      // measured offsetHeight = 0 in happy-dom → fallback to expandedHeight = 700
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 700px')
    })

    it('should update height during drag', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      const handle = wrapper.find('.drag-handle').element
      // Start drag at y=500 (sheet is at 700px)
      firePointer(handle, 'pointerdown', 500)
      // Move down 100px → newHeight = 700 - (600 - 500) = 600
      firePointer(handle, 'pointermove', 600)
      await nextTick()
      const style = wrapper.find('.bottom-sheet').attributes('style') ?? ''
      expect(style).toContain('height: 600px')
    })

    it('should clamp height to expanded ceiling during drag', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      const handle = wrapper.find('.drag-handle').element
      firePointer(handle, 'pointerdown', 500)
      // Move up by 400px → would be 1100px but clamped to 700 (expandedHeight)
      firePointer(handle, 'pointermove', 100)
      await nextTick()
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 700px')
    })

    it('should clamp height to peek floor during drag', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      const handle = wrapper.find('.drag-handle').element
      firePointer(handle, 'pointerdown', 300)
      // Move down by 600px → would be 0 but clamped to peekHeight (~0 in test env)
      firePointer(handle, 'pointermove', 900)
      await nextTick()
      const styleAttr = wrapper.find('.bottom-sheet').attributes('style') ?? ''
      const heightMatch = styleAttr.match(/height: (\d+)px/)
      const h = heightMatch ? Number(heightMatch[1]) : 999
      expect(h).toBeLessThanOrEqual(400)
    })

    it('should snap to expanded when released after large upward drag', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      const handle = wrapper.find('.drag-handle').element
      firePointer(handle, 'pointerdown', 500)
      // Move up ~200px → currentHeight clamped at 700 → nearest snap = expanded
      firePointer(handle, 'pointermove', 300)
      firePointer(handle, 'pointerup', 300)
      await nextTick()
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 700px')
    })

    it('should keep current snap when tap (< 4px movement)', async () => {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      const handle = wrapper.find('.drag-handle').element
      firePointer(handle, 'pointerdown', 500)
      // Move only 2px — below threshold
      firePointer(handle, 'pointermove', 502)
      firePointer(handle, 'pointerup', 502)
      await nextTick()
      // Should remain at current snap (expanded = 700px in test env)
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 700px')
    })
  })

  describe('keyboard navigation', () => {
    async function mountAndGetHandle() {
      const wrapper = mount(BottomSheet, { props: { title: 'Test' } })
      await flushPromises()
      // starts at expanded (index 2) — natural height unmeasurable in happy-dom → fallback
      return wrapper
    }

    it('should stay at expanded on ArrowUp when already expanded', async () => {
      const wrapper = await mountAndGetHandle()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'ArrowUp' })
      await nextTick()
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 700px')
      expect(wrapper.find('.drag-handle').attributes('aria-valuenow')).toBe('2')
    })

    it('should go to default snap on ArrowDown from expanded', async () => {
      const wrapper = await mountAndGetHandle()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'ArrowDown' })
      await nextTick()
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 400px')
      expect(wrapper.find('.drag-handle').attributes('aria-valuenow')).toBe('1')
    })

    it('should cycle expanded → default → peek on repeated ArrowDown', async () => {
      const wrapper = await mountAndGetHandle()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'ArrowDown' })
      await nextTick()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'ArrowDown' })
      await nextTick()
      const style = wrapper.find('.bottom-sheet').attributes('style') ?? ''
      const h = Number(style.match(/height: (\d+)px/)?.[1] ?? -1)
      expect(h).toBeLessThan(400)
      expect(wrapper.find('.drag-handle').attributes('aria-valuenow')).toBe('0')
    })

    it('should not advance past expanded on ArrowUp', async () => {
      const wrapper = await mountAndGetHandle()
      expect(wrapper.find('.drag-handle').attributes('aria-valuenow')).toBe('2')
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'ArrowUp' })
      await nextTick()
      expect(wrapper.find('.drag-handle').attributes('aria-valuenow')).toBe('2')
    })

    it('should jump to expanded on Home key', async () => {
      const wrapper = await mountAndGetHandle()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'ArrowDown' })
      await nextTick()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'Home' })
      await nextTick()
      expect(wrapper.find('.bottom-sheet').attributes('style')).toContain('height: 700px')
    })

    it('should jump to peek on End key', async () => {
      const wrapper = await mountAndGetHandle()
      await wrapper.find('.drag-handle').trigger('keydown', { key: 'End' })
      await nextTick()
      const style = wrapper.find('.bottom-sheet').attributes('style') ?? ''
      const h = Number(style.match(/height: (\d+)px/)?.[1] ?? -1)
      expect(h).toBeLessThan(400)
      expect(wrapper.find('.drag-handle').attributes('aria-valuenow')).toBe('0')
    })
  })

  describe('scrolling content', () => {
    it('should not modify sheet height when content area receives scroll events', async () => {
      const wrapper = mount(BottomSheet, {
        props: { title: 'Test' },
        slots: { default: '<div style="height:2000px">tall content</div>' },
      })
      await flushPromises()
      const initialStyle = wrapper.find('.bottom-sheet').attributes('style')
      // Dispatch wheel/scroll on the content — should not affect height
      wrapper.find('.content').element.dispatchEvent(new Event('scroll', { bubbles: false }))
      await nextTick()
      expect(wrapper.find('.bottom-sheet').attributes('style')).toBe(initialStyle)
    })
  })
})
