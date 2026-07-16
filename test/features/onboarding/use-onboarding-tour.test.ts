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
  refresh: ReturnType<typeof vi.fn>
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
      refresh: vi.fn(),
    }
    inst.highlight = inst.highlight.bind(inst)
    inst.destroy = inst.destroy.bind(inst)
    driverInstances.push(inst)
    return inst
  }),
}))

// --- helpers -----------------------------------------------------------------
const LAST = ONBOARDING_STEPS.length - 1
// Highlighting now waits for the target's position to settle (~5 frames of
// 16 ms), so flushing a step takes a beat longer than a single macrotask.
const flush = () => new Promise(r => setTimeout(r, 300))
const lastDriver = () => driverInstances[driverInstances.length - 1]
// A target is highlighted twice: spotlight-only first, then re-highlighted with
// the popover once the layout settles. Assert against the popover-bearing call.
function popoverTitle(d: MockDriver = lastDriver()) {
  return d.highlighted.at(-1)?.popover?.title
}

function mountAllAnchors() {
  document.body.innerHTML = ONBOARDING_STEPS
    .map(s => `<div ${s.target.slice(1, -1)}></div>`)
    .join('')
}

function makeOptions(overrides: Partial<Parameters<typeof useOnboardingTour>[0]> = {}) {
  return {
    steps: ONBOARDING_STEPS,
    stage: vi.fn(() => Promise.resolve()),
    cleanup: vi.fn(),
    saveTourStep: vi.fn(() => Promise.resolve()),
    dismissTourAtSignIn: vi.fn(() => Promise.resolve()),
    canAutoStart: vi.fn(() => true),
    getResumeStep: vi.fn(() => 0),
    // Tiny pacing so real-timer tests stay fast (prod defaults are >1s/step).
    pace: { holdMs: 20, gapMs: 20 },
    ...overrides,
  }
}

beforeEach(() => {
  driverInstances.length = 0
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('useOnboardingTour — auto-start welcome gate', () => {
  it('does NOT open the welcome when the gate is closed', async () => {
    const opts = makeOptions({ canAutoStart: vi.fn(() => false) })
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()

    expect(tour.showWelcome.value).toBe(false)
    expect(opts.dismissTourAtSignIn).not.toHaveBeenCalled()
    expect(driverInstances).toHaveLength(0)
    expect(tour.isRunning.value).toBe(false)
  })

  it('opens the welcome when the gate is open — without starting or flipping the gate', async () => {
    mountAllAnchors()
    const opts = makeOptions()
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()

    expect(tour.showWelcome.value).toBe(true)
    expect(tour.isRunning.value).toBe(false)
    expect(driverInstances).toHaveLength(0)
    expect(opts.dismissTourAtSignIn).not.toHaveBeenCalled()
  })

  it('does not reopen the welcome while it is already showing', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.maybeStartTour()
    await flush()
    tour.maybeStartTour()
    await flush()

    expect(tour.showWelcome.value).toBe(true)
    expect(driverInstances).toHaveLength(0)
  })

  it('start: begins the tour at the resume step and flips the gate off', async () => {
    mountAllAnchors()
    const opts = makeOptions({ getResumeStep: vi.fn(() => 2) })
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()
    tour.startFromWelcome()
    await flush()

    expect(tour.showWelcome.value).toBe(false)
    expect(tour.isRunning.value).toBe(true)
    expect(opts.dismissTourAtSignIn).toHaveBeenCalledTimes(1)
    expect(popoverTitle()).toBe(ONBOARDING_STEPS[2].titleKey)
  })

  it('skip for now: closes the welcome but leaves the gate untouched', async () => {
    const opts = makeOptions()
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()
    tour.skipWelcome()

    expect(tour.showWelcome.value).toBe(false)
    expect(tour.isRunning.value).toBe(false)
    expect(opts.dismissTourAtSignIn).not.toHaveBeenCalled()
    expect(driverInstances).toHaveLength(0)
  })

  it('don\'t show again: closes the welcome and flips the gate off', async () => {
    const opts = makeOptions()
    const tour = useOnboardingTour(opts)
    tour.maybeStartTour()
    await flush()
    tour.dismissWelcome()

    expect(tour.showWelcome.value).toBe(false)
    expect(tour.isRunning.value).toBe(false)
    expect(opts.dismissTourAtSignIn).toHaveBeenCalledTimes(1)
    expect(driverInstances).toHaveLength(0)
  })
})

describe('useOnboardingTour — resume + clamp', () => {
  it('resumes at the given step index', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.startTour(2)
    await flush()

    expect(tour.currentIndex.value).toBe(2)
    expect(popoverTitle()).toBe(ONBOARDING_STEPS[2].titleKey)
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

describe('useOnboardingTour — banner navigation', () => {
  it('exposes the total step count', () => {
    const tour = useOnboardingTour(makeOptions())
    expect(tour.totalSteps).toBe(ONBOARDING_STEPS.length)
  })

  it('next advances and back returns, re-staging each step', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.startTour(0)
    await flush()
    expect(tour.currentIndex.value).toBe(0)

    tour.next()
    await flush()
    expect(tour.currentIndex.value).toBe(1)

    tour.back()
    await flush()
    expect(tour.currentIndex.value).toBe(0)
  })

  it('back at step 0 is a no-op (does not go negative)', async () => {
    mountAllAnchors()
    const tour = useOnboardingTour(makeOptions())
    tour.startTour(0)
    await flush()

    tour.back()
    await flush()

    expect(tour.currentIndex.value).toBe(0)
  })
})

describe('useOnboardingTour — persistence', () => {
  it('persists the current index when dismissed mid-tour', async () => {
    mountAllAnchors()
    const opts = makeOptions()
    const tour = useOnboardingTour(opts)
    tour.startTour(2)
    await flush()

    tour.finish()

    expect(opts.saveTourStep).toHaveBeenCalledWith(2)
    expect(lastDriver().destroyed).toBe(true)
    expect(tour.isRunning.value).toBe(false)
  })

  it('resets the resume point to 0 when advancing past the final step', async () => {
    mountAllAnchors()
    const opts = makeOptions()
    const tour = useOnboardingTour(opts)
    tour.startTour(LAST)
    await flush()

    tour.next()
    await flush()

    expect(opts.saveTourStep).toHaveBeenCalledWith(0)
    expect(lastDriver().destroyed).toBe(true)
  })

  it('fires onCompleted only when the tour runs to the end', async () => {
    mountAllAnchors()
    const onCompleted = vi.fn()
    const tour = useOnboardingTour(makeOptions({ onCompleted }))
    tour.startTour(LAST)
    await flush()

    tour.next() // advance past the last step → completed
    await flush()

    expect(onCompleted).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onCompleted on an early "Finish tour" dismissal', async () => {
    mountAllAnchors()
    const onCompleted = vi.fn()
    const tour = useOnboardingTour(makeOptions({ onCompleted }))
    tour.startTour(0)
    await flush()

    tour.finish() // dismissed before the final step
    await flush()

    expect(onCompleted).not.toHaveBeenCalled()
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
    expect(popoverTitle()).toBe(ONBOARDING_STEPS[1].titleKey)
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
    // Generous: highlight waits ~80 ms position-stability after the 20 ms insert.
    await flush()

    expect(popoverTitle()).toBe(ONBOARDING_STEPS[0].titleKey)
  })
})

describe('useOnboardingTour — staging spotlights', () => {
  it('runs the discrete sequence: waypoint spotlight on → off → target spotlight on', async () => {
    vi.useFakeTimers()
    document.body.innerHTML
      = `<button data-tour="open-menu"></button><div ${ONBOARDING_STEPS[0].target.slice(1, -1)}></div>`
    const opts = makeOptions({
      stage: vi.fn(async (_s, ctx) => {
        await ctx.spotlight('[data-tour="open-menu"]')
      }),
    })
    const tour = useOnboardingTour(opts)
    tour.startTour(0)
    await vi.advanceTimersByTimeAsync(3000)
    vi.useRealTimers()

    // Two separate masks: the waypoint's is torn down before the target's goes up.
    expect(driverInstances).toHaveLength(2)
    const [waypoint, target] = driverInstances
    expect(waypoint.highlighted[0].element).toBe(document.querySelector('[data-tour="open-menu"]'))
    expect(waypoint.highlighted[0].popover).toBeUndefined() // no hintKey → bare spotlight
    expect(waypoint.destroyed).toBe(true)
    // Two-phase reveal: spotlight first (no copy), then the popover.
    expect(target.highlighted[0].popover).toBeUndefined()
    expect(popoverTitle(target)).toBe(ONBOARDING_STEPS[0].titleKey)
    expect(target.destroyed).toBe(false)
  })

  it('attaches a hint popover to a waypoint when a hintKey is given', async () => {
    vi.useFakeTimers()
    document.body.innerHTML
      = `<button data-tour="open-menu"></button><div ${ONBOARDING_STEPS[0].target.slice(1, -1)}></div>`
    const opts = makeOptions({
      stage: vi.fn(async (_s, ctx) => {
        await ctx.spotlight('[data-tour="open-menu"]', 'onboarding.tour.nav.openMenu')
      }),
    })
    const tour = useOnboardingTour(opts)
    tour.startTour(0)
    await vi.advanceTimersByTimeAsync(3000)
    vi.useRealTimers()

    const [waypoint] = driverInstances
    // Hint popover: description only (mocked t echoes the key), no title.
    expect(waypoint.highlighted[0].popover?.description).toBe('onboarding.tour.nav.openMenu')
    expect(waypoint.highlighted[0].popover?.title).toBeUndefined()
  })

  it('skips a spotlight whose control never appears, still highlighting the target', async () => {
    vi.useFakeTimers()
    document.body.innerHTML = `<div ${ONBOARDING_STEPS[0].target.slice(1, -1)}></div>`
    const opts = makeOptions({
      stage: vi.fn(async (_s, ctx) => {
        await ctx.spotlight('[data-tour="never-here"]')
      }),
    })
    const tour = useOnboardingTour(opts)
    tour.startTour(0)
    await vi.advanceTimersByTimeAsync(3000)
    vi.useRealTimers()

    expect(driverInstances).toHaveLength(1)
    const hl = lastDriver().highlighted
    // Two-phase reveal: spotlight-only, then the popover.
    expect(hl).toHaveLength(2)
    expect(hl[0].popover).toBeUndefined()
    expect(popoverTitle()).toBe(ONBOARDING_STEPS[0].titleKey)
  })
})
