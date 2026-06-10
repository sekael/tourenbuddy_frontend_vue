import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOnboardingTour } from '@/features/onboarding/presentation/composables/use-onboarding-tour'
import { ONBOARDING_STEPS } from '@/features/onboarding/presentation/onboarding-steps'

// --- mocks -------------------------------------------------------------------
vi.mock('driver.js/dist/driver.css', () => ({}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/core/logging/use-logger', () => ({
  useLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

interface MockDriver {
  config: any
  highlighted: any[]
  destroyed: boolean
  highlight: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}
const driverInstances: MockDriver[] = []
vi.mock('driver.js', () => ({
  driver: vi.fn((config: any) => {
    const inst: MockDriver = {
      config,
      highlighted: [],
      destroyed: false,
      highlight: vi.fn(function (this: MockDriver, step: any) {
        this.highlighted.push(step)
      }),
      destroy: vi.fn(function (this: MockDriver) {
        this.destroyed = true
      }),
    }
    inst.highlight = inst.highlight.bind(inst)
    inst.destroy = inst.destroy.bind(inst)
    driverInstances.push(inst)
    return inst
  }),
}))

// --- helpers -----------------------------------------------------------------
const LAST = ONBOARDING_STEPS.length - 1
const flush = () => new Promise(r => setTimeout(r, 0))
const lastDriver = () => driverInstances[driverInstances.length - 1]

function mountAllAnchors() {
  document.body.innerHTML = ONBOARDING_STEPS
    .map(s => `<div ${s.target.slice(1, -1)}></div>`)
    .join('')
}

function makeOptions(overrides: Partial<Parameters<typeof useOnboardingTour>[0]> = {}) {
  return {
    stage: vi.fn(() => Promise.resolve()),
    cleanup: vi.fn(),
    saveTourStep: vi.fn(() => Promise.resolve()),
    dismissTourAtSignIn: vi.fn(() => Promise.resolve()),
    canAutoStart: vi.fn(() => true),
    getResumeStep: vi.fn(() => 0),
    ...overrides,
  }
}

beforeEach(() => {
  driverInstances.length = 0
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('useOnboardingTour — auto-start guard', () => {
  it('does NOT auto-start when the gate is closed', async () => {
    const opts = makeOptions({ canAutoStart: vi.fn(() => false) })
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()

    expect(opts.dismissTourAtSignIn).not.toHaveBeenCalled()
    expect(driverInstances).toHaveLength(0)
    expect(tour.isRunning.value).toBe(false)
  })

  it('auto-starts when gate is open: dismisses the gate and highlights step 0', async () => {
    mountAllAnchors()
    const opts = makeOptions()
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()

    expect(opts.dismissTourAtSignIn).toHaveBeenCalledTimes(1)
    expect(lastDriver().highlighted[0].popover.title).toBe(ONBOARDING_STEPS[0].titleKey)
    expect(tour.isRunning.value).toBe(true)
  })

  it('does not start a second time while already running', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.maybeStartTour()
    await flush()
    tour.maybeStartTour()
    await flush()

    expect(driverInstances).toHaveLength(1)
  })
})

describe('useOnboardingTour — resume + clamp', () => {
  it('resumes at the persisted step index', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions({ getResumeStep: vi.fn(() => 2) }))
    tour.maybeStartTour()
    await flush()

    expect(tour.currentIndex.value).toBe(2)
    expect(lastDriver().highlighted[0].popover.title).toBe(ONBOARDING_STEPS[2].titleKey)
  })

  it('clamps an out-of-range high index to the last step', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.startTour(99)
    await flush()

    expect(tour.currentIndex.value).toBe(LAST)
  })

  it('clamps a negative index to 0', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.startTour(-5)
    await flush()

    expect(tour.currentIndex.value).toBe(0)
  })
})

describe('useOnboardingTour — persistence', () => {
  it('persists the current index when dismissed mid-tour', async () => {
    mountAllAnchors()
    const opts = makeOptions({ getResumeStep: vi.fn(() => 2) })
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()

    lastDriver().highlighted[0].popover.onCloseClick()

    expect(opts.saveTourStep).toHaveBeenCalledWith(2)
    expect(lastDriver().destroyed).toBe(true)
    expect(tour.isRunning.value).toBe(false)
  })

  it('resets the resume point to 0 when advancing past the final step', async () => {
    mountAllAnchors()
    const opts = makeOptions({ getResumeStep: vi.fn(() => LAST) })
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()

    lastDriver().highlighted[0].popover.onNextClick()
    await flush()

    expect(opts.saveTourStep).toHaveBeenCalledWith(0)
    expect(lastDriver().destroyed).toBe(true)
  })
})

describe('useOnboardingTour — missing target', () => {
  it('skips a step whose target is absent rather than erroring', async () => {
    // Only the second step's target exists; step 0 is absent so it must skip.
    // A missing target resolves only after `waitForElement`'s timeout, so drive
    // timers rather than waiting wall-clock.
    vi.useFakeTimers()
    document.body.innerHTML = `<div ${ONBOARDING_STEPS[1].target.slice(1, -1)}></div>`
    const tour = useOnboardingTour(makeOptions())
    tour.startTour(0)
    await vi.advanceTimersByTimeAsync(2100)
    vi.useRealTimers()

    expect(tour.currentIndex.value).toBe(1)
    expect(lastDriver().highlighted[0].popover.title).toBe(ONBOARDING_STEPS[1].titleKey)
  })

  // GAP VERIFIER: passes only once `waitForElement` actually polls. The target
  // is inserted on the next macrotask (simulating an overlay animating in).
  // Un-skip this after filling the gap in use-onboarding-tour.ts.
  it('awaits a target that appears shortly after staging', async () => {
    const opts = makeOptions({
      stage: vi.fn(() => {
        setTimeout(() => {
          document.body.innerHTML = `<div ${ONBOARDING_STEPS[0].target.slice(1, -1)}></div>`
        }, 20)
        return Promise.resolve()
      }),
    })
    const tour = useOnboardingTour(opts)
    tour.startTour(0)
    await new Promise(r => setTimeout(r, 100))

    expect(lastDriver().highlighted[0].popover.title).toBe(ONBOARDING_STEPS[0].titleKey)
  })
})
