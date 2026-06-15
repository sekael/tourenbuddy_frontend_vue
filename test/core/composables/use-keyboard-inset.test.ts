import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { useKeyboardInset } from '@/core/composables/use-keyboard-inset'

/** Minimal scriptable stand-in for the real visualViewport. */
function makeViewport(height: number, offsetTop = 0) {
  const listeners: Record<string, Array<() => void>> = { resize: [], scroll: [] }
  return {
    height,
    offsetTop,
    addEventListener(type: string, cb: () => void) {
      listeners[type]?.push(cb)
    },
    removeEventListener(type: string, cb: () => void) {
      const arr = listeners[type]
      const i = arr?.indexOf(cb) ?? -1
      if (i >= 0)
        arr.splice(i, 1)
    },
    emit(type: string) {
      listeners[type]?.forEach(cb => cb())
    },
    listenerCount(type: string) {
      return listeners[type]?.length ?? 0
    },
  }
}

function mountWith(vv: ReturnType<typeof makeViewport> | undefined) {
  Object.defineProperty(window, 'innerHeight', { value: 1000, writable: true, configurable: true })
  Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true })
  const host = defineComponent({
    setup: () => useKeyboardInset(),
    render: () => null,
  })
  return mount(host)
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { value: undefined, writable: true, configurable: true })
})

describe('useKeyboardInset', () => {
  it('reports a positive inset when the visual viewport shrinks', async () => {
    const vv = makeViewport(1000)
    const wrapper = mountWith(vv)
    expect(wrapper.vm.inset).toBe(0)

    vv.height = 600
    vv.emit('resize')
    expect(wrapper.vm.inset).toBe(400)
  })

  it('accounts for the iOS offsetTop term on scroll', async () => {
    const vv = makeViewport(700, 0)
    const wrapper = mountWith(vv)
    vv.offsetTop = 100 // visual viewport scrolled within the layout viewport
    vv.emit('scroll')
    // 1000 − (700 + 100) = 200
    expect(wrapper.vm.inset).toBe(200)
  })

  it('clamps a negative computation to zero', async () => {
    const vv = makeViewport(1100) // taller than innerHeight (transition artifact)
    const wrapper = mountWith(vv)
    expect(wrapper.vm.inset).toBe(0)
  })

  it('stays at zero when visualViewport is unsupported', async () => {
    const wrapper = mountWith(undefined)
    expect(wrapper.vm.inset).toBe(0)
  })

  it('removes both listeners on unmount', async () => {
    const vv = makeViewport(1000)
    const wrapper = mountWith(vv)
    expect(vv.listenerCount('resize')).toBe(1)
    expect(vv.listenerCount('scroll')).toBe(1)
    wrapper.unmount()
    expect(vv.listenerCount('resize')).toBe(0)
    expect(vv.listenerCount('scroll')).toBe(0)
  })
})
