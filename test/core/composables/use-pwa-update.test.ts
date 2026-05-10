import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mockUpdateSW = vi.fn()
const mockNeedRefresh = ref(false)
let capturedControllerChangeListener: (() => void) | undefined

vi.mock('virtual:pwa-register/vue', () => ({
  useRegisterSW: () => ({ needRefresh: mockNeedRefresh, updateSW: mockUpdateSW }),
}))

const mockAddEventListener = vi.fn((event: string, listener: () => void) => {
  if (event === 'controllerchange') {
    capturedControllerChangeListener = listener
  }
})

Object.defineProperty(navigator, 'serviceWorker', {
  value: { addEventListener: mockAddEventListener },
  writable: true,
  configurable: true,
})

describe('usePwaUpdate', () => {
  beforeEach(async () => {
    mockNeedRefresh.value = false
    mockUpdateSW.mockClear()
    capturedControllerChangeListener = undefined
    vi.resetModules()
  })

  it('should set needRefresh to false on dismiss without calling updateSW', async () => {
    const { usePwaUpdate } = await import('@/core/composables/use-pwa-update')
    mockNeedRefresh.value = true
    const { dismiss } = usePwaUpdate()
    dismiss()
    expect(mockNeedRefresh.value).toBe(false)
    expect(mockUpdateSW).not.toHaveBeenCalled()
  })

  it('should call updateSW(true) exactly once on accept', async () => {
    const { usePwaUpdate } = await import('@/core/composables/use-pwa-update')
    const { accept } = usePwaUpdate()
    accept()
    expect(mockUpdateSW).toHaveBeenCalledTimes(1)
    expect(mockUpdateSW).toHaveBeenCalledWith(true)
  })

  it('should reload once and guard against second controllerchange', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})

    const { usePwaUpdate } = await import('@/core/composables/use-pwa-update')
    usePwaUpdate()

    expect(capturedControllerChangeListener).toBeDefined()
    capturedControllerChangeListener!()
    capturedControllerChangeListener!()

    expect(reloadSpy).toHaveBeenCalledTimes(1)
    reloadSpy.mockRestore()
  })

  it('should not reload on controllerchange when document is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    })
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {})

    const { usePwaUpdate } = await import('@/core/composables/use-pwa-update')
    usePwaUpdate()

    capturedControllerChangeListener!()

    expect(reloadSpy).not.toHaveBeenCalled()
    reloadSpy.mockRestore()
  })
})
