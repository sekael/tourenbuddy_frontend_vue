import type { Driver, Popover } from 'driver.js'
import type { OnboardingStep, TourSurface } from '../onboarding-steps'
import { driver } from 'driver.js'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
import 'driver.js/dist/driver.css'
import '../onboarding-tour.css'

/** Capabilities handed to `stage` so it can choreograph the navigation. */
export interface StageContext {
  /**
   * Spotlight an intermediate control (the speed-dial FAB, a menu item, a tab)
   * on the way to the step's target: previous spotlight off → wait for the
   * control to exist and stop moving → spotlight on → hold a beat. Pass a
   * `hintKey` to attach a short one-line popover ("Open menu", "Open contacts")
   * naming the control; omit it for a bare spotlight. No-op if the control
   * never appears.
   */
  spotlight: (selector: string, hintKey?: string) => Promise<void>
}

export interface UseOnboardingTourOptions {
  /**
   * The steps this instance drives, in presentation order. Injected (not
   * imported) so the same choreography can host the map tour (`ONBOARDING_STEPS`)
   * or the calendar tour (`CALENDAR_TOUR_STEPS`).
   */
  steps: OnboardingStep[]
  /**
   * Make a step's surface visible (open the right overlay / speed-dial view).
   * May be async — staging an overlay animates it in. Use `ctx.spotlight` to
   * highlight each control on the navigation path before opening the next one.
   */
  stage: (surface: TourSurface, ctx: StageContext) => void | Promise<void>
  /** Close whatever the tour opened once it ends. */
  cleanup: () => void
  /**
   * Fired ONLY when the tour is run to completion (advanced past the last step),
   * not on an early "Finish tour" dismissal. The map tour uses this to hand off
   * to the calendar route; the calendar tour omits it. Runs after teardown.
   */
  onCompleted?: () => void
  /** Persist the resume index. Non-blocking (swallows/logs its own errors). */
  saveTourStep: (n: number) => void | Promise<void>
  /** Flip the auto-start gate off. Non-blocking. */
  dismissTourAtSignIn: () => void | Promise<void>
  /** True only when authenticated AND profile loaded AND show-at-sign-in is set. */
  canAutoStart: () => boolean
  /** The persisted resume index (`onboarding_tour_last_step`). */
  getResumeStep: () => number
  /** Override transition pacing (tests use tiny values). */
  pace?: Partial<TourPace>
}

/** Pacing of the staged transitions. */
export interface TourPace {
  /** How long a waypoint spotlight is held so the user can register it. */
  holdMs: number
  /** Breath between a spotlight going down and the next one going up. */
  gapMs: number
}

const DEFAULT_PACE: TourPace = { holdMs: 2000, gapMs: 500 }

export function useOnboardingTour(options: UseOnboardingTourOptions) {
  const { t } = useI18n({ useScope: 'global' })
  const logger = useLogger('OnboardingTour')

  const steps = options.steps
  const LAST_INDEX = steps.length - 1

  const isRunning = ref(false)
  // True while the pre-tour welcome screen is showing (auto-start only, before
  // the driver.js tour itself runs). The component renders its own backdrop.
  const showWelcome = ref(false)
  const currentIndex = ref(0)
  // True while a step is being staged (mask removed, app being driven). Nav
  // controls are inert during this window so rapid clicks can't overlap stages.
  const isStaging = ref(false)
  let driverObj: Driver | null = null

  const pace: TourPace = { ...DEFAULT_PACE, ...options.pace }
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const clamp = (i: number) => Math.max(0, Math.min(i, LAST_INDEX))

  // Short label for the current step, shown in the top banner (distinct from the
  // benefit-oriented popover title).
  const currentTitle = computed(() => t(steps[currentIndex.value].labelKey))

  /**
   * Resolve the first *visible* element matching `selector`, or the first match
   * if none is visible. Responsive components render both layouts and hide one
   * with `display:none` (e.g. calendar-nav's desktop sidebar + mobile bottom
   * bar share `data-tour="nav-seasons"`); a plain `querySelector` would return
   * the hidden DOM-first one, anchoring the spotlight to a zero rect. A
   * `display:none` element has no client rects, so filter on that.
   */
  function findVisible(selector: string): Element | null {
    const els = [...document.querySelectorAll(selector)]
    return els.find(el => el.getClientRects().length > 0) ?? els[0] ?? null
  }

  /**
   * Resolve the first visible element matching `selector`, or null if it never
   * appears within `timeoutMs`. A staged overlay animates in (Transition
   * mode="out-in"), so the target is often not in the DOM the instant we stage it.
   */
  function waitForElement(selector: string, timeoutMs = 1000): Promise<Element | null> {
    return new Promise((resolve) => {
      nextTick(() => {
        const existing = findVisible(selector)
        if (existing)
          return resolve(existing)

        let timer: ReturnType<typeof setTimeout>

        const observer = new MutationObserver(() => {
          const el = findVisible(selector)
          if (el) {
            observer.disconnect()
            clearTimeout(timer)
            resolve(el)
          }
        })

        observer.observe(document.body, { childList: true, subtree: true })

        timer = setTimeout(() => {
          observer.disconnect()
          resolve(null)
        }, timeoutMs)
      })
    })
  }

  function teardown() {
    driverObj?.destroy()
    driverObj = null
    isRunning.value = false
    options.cleanup()
  }

  /** Dismiss via the "Finish tour" button: persist the current step. */
  function finishDismiss() {
    options.saveTourStep(currentIndex.value)
    teardown()
  }

  /**
   * Hard-stop on navigation / unmount. driver.js appends its overlay directly to
   * <body> (outside Vue), so if the host page unmounts without this the overlay
   * orphans onto the next route. Persist the resume step, drop the welcome, and
   * tear the driver overlay down. Idempotent — safe to call when nothing runs.
   */
  function stop() {
    if (isRunning.value)
      options.saveTourStep(currentIndex.value)
    showWelcome.value = false
    teardown()
  }

  /** Advanced past the final step: reset resume point so a reopen replays. */
  function finishCompleted() {
    options.saveTourStep(0)
    teardown()
    options.onCompleted?.()
  }

  /** Next button / backdrop tap. */
  function advance() {
    if (isStaging.value)
      return
    if (currentIndex.value >= LAST_INDEX) {
      finishCompleted()
      return
    }
    void goToStep(currentIndex.value + 1, 1)
  }

  function back() {
    if (isStaging.value || currentIndex.value <= 0)
      return
    void goToStep(currentIndex.value - 1, -1)
  }

  function buildPopover(index: number): Popover {
    const step = steps[index]
    // No footer buttons: all navigation (back / next / finish + progress) lives
    // in the top banner (`onboarding-tour-banner.vue`), driven via the exposed
    // `back` / `next` / `finish` actions. Tap-away still advances (overlay
    // click behavior). The popover is title + description only.
    return {
      title: t(step.titleKey),
      description: t(step.bodyKey),
      showButtons: [],
      // Render below the target by default: the control banner is pinned to the
      // top, so a popover placed below its anchor never collides with it. A step
      // can override `side`/`align` when its target sits low in a tall surface
      // and `bottom` would overflow the screen (driver.js would then flip it up
      // into the banner). See `OnboardingStep.side`.
      side: step.side ?? 'bottom',
      align: step.align ?? 'center',
    }
  }

  function makeDriver(): Driver {
    return driver({
      animate: true,
      allowClose: false, // no Esc / backdrop-close; "Finish tour" is the only dismiss
      overlayClickBehavior: () => advance(), // backdrop tap advances
      disableActiveInteraction: true, // highlighted control is inert
      stageRadius: 18, // softer spotlight cutout corners (default 5)
      popoverClass: 'onboarding-tour-popover',
    })
  }

  /** Turn the current spotlight off (mask fully down). True if one was up. */
  function maskOff(): boolean {
    const hadMask = driverObj !== null
    driverObj?.destroy()
    driverObj = null
    return hadMask
  }

  /** Spotlight off + a beat of breath, so off → on never reads as a jump. */
  async function maskOffAndBreathe() {
    if (maskOff())
      await sleep(pace.gapMs)
  }

  /**
   * Re-anchor stage + popover once any residual motion stops. driver.js
   * positions the popover ONCE at highlight time while the stage tweens with
   * live rects — so a sheet-transition tail or a smooth scroll that finishes
   * after `highlight()` leaves the popover pinned to a stale rect (cutout
   * right, message floating over it). Fire-and-forget; cancelled implicitly
   * when the driver instance changes (next step / finish).
   */
  async function refreshAfterMotion(el: Element) {
    const obj = driverObj
    if (!obj)
      return
    // Snapshot where the popover was anchored, so we only re-position if the
    // target actually drifted. A blind refresh re-runs driver's placement even
    // when nothing moved — that needless reposition is the visible popover
    // "jump" the user sees; skipping it keeps the message put once it's placed.
    const before = el.getBoundingClientRect()
    // Give late motion a chance to start…
    await sleep(pace.gapMs)
    if (driverObj !== obj || !isRunning.value)
      return
    // …then wait for it to stop and recompute with fresh rects.
    await waitForPosition(el, 1500)
    if (driverObj !== obj || !isRunning.value)
      return
    const after = el.getBoundingClientRect()
    const moved
      = Math.abs(after.top - before.top) > 1
        || Math.abs(after.left - before.left) > 1
        || Math.abs(after.width - before.width) > 1
        || Math.abs(after.height - before.height) > 1
    if (moved)
      obj.refresh()
  }

  /**
   * Wait until `el`'s bounding rect is stable for several consecutive frames
   * (~80 ms of stillness). Sheets and menus animate in — highlighting
   * mid-animation pins the popover at a stale position, since driver.js
   * positions it exactly once. The window must be generous enough to also
   * catch motion that hasn't started yet (transition delays).
   */
  async function waitForPosition(el: Element, timeoutMs = 1200): Promise<void> {
    const frame = () => new Promise(resolve => setTimeout(resolve, 16))
    const deadline = Date.now() + timeoutMs
    let last = el.getBoundingClientRect()
    let stableFrames = 0
    while (Date.now() < deadline) {
      await frame()
      const rect = el.getBoundingClientRect()
      const same
        = rect.top === last.top
          && rect.left === last.left
          && rect.width === last.width
          && rect.height === last.height
      stableFrames = same ? stableFrames + 1 : 0
      if (stableFrames >= 5)
        return
      last = rect
    }
  }

  /**
   * Spotlight an intermediate navigation control. Self-contained sequence:
   * control exists + stopped moving → spotlight on → hold → spotlight OFF →
   * breath. Tearing down before returning matters: the caller's next move is
   * opening another surface, and a leftover spotlight would stay pinned on the
   * old control during that transition. Handed to `stage` via the context.
   * No-op if the element never appears or the tour ended mid-wait.
   */
  async function spotlight(selector: string, hintKey?: string) {
    if (!isRunning.value)
      return
    await maskOffAndBreathe() // safety: normally already down
    const el = await waitForElement(selector, 700)
    if (!el || !isRunning.value)
      return
    await waitForPosition(el)
    if (!isRunning.value)
      return
    driverObj = makeDriver()
    // A hinted waypoint shows a short, description-only popover ("Open menu")
    // naming the control; without a hint it stays a bare spotlight. No forced
    // side — driver.js auto-places it to fit, since waypoints sit anywhere
    // (bottom-right FAB, mid-list menu item, action-bar tab).
    driverObj.highlight(
      hintKey
        ? {
            element: el,
            popover: {
              description: t(hintKey),
              showButtons: [],
              popoverClass: 'onboarding-hint-popover',
            },
          }
        : { element: el },
    )
    void refreshAfterMotion(el)
    await sleep(pace.holdMs)
    await maskOffAndBreathe()
  }

  /**
   * Move to `index`. Every step replays its full path from scratch. The cycle:
   *   1. previous spotlight off,
   *   2. drive the navigation — `stage` spotlights each waypoint (FAB → menu
   *      item → …), each one: off → ready (position settled) → on → hold,
   *   3. waypoint spotlight off, wait for the target to settle, then mask up
   *      on the target + its message.
   * `direction` (+1 / -1) decides which way to skip a target that never shows.
   */
  async function goToStep(index: number, direction: 1 | -1) {
    if (!isRunning.value)
      return
    isStaging.value = true
    try {
      const clamped = clamp(index)
      currentIndex.value = clamped
      const step: OnboardingStep = steps[clamped]

      // 1. Remove the dark mask completely while we navigate.
      await maskOffAndBreathe()

      // 2. Drive the app to the target, spotlighting each waypoint en route.
      await options.stage(step.surface, { spotlight })
      const el = await waitForElement(step.target)

      // Tour may have been finished during the awaited navigation.
      if (!isRunning.value)
        return

      if (!el) {
        logger.warn(`Onboarding target missing, skipping step ${clamped}: ${step.target}`)
        const next = clamped + direction
        if (next < 0 || next > LAST_INDEX) {
          finishDismiss()
          return
        }
        await goToStep(next, direction)
        return
      }

      // 3. Target settled in place → fresh mask up. Never highlight a moving
      //    element. (Waypoint spotlights tear themselves down; this maskOff is a
      //    safety net.)
      await maskOffAndBreathe()
      // Scroll the whole target into view first: driver.js only auto-scrolls
      // fully off-screen elements, so a tall section (e.g. the notification
      // toggles in the mobile profile sheet) would peek just its header.
      // `block: 'start'` tops the section so its content is visible. The
      // scroll MUST be instant: a smooth scroll starts asynchronously, so the
      // stability check below can pass before it even begins — the popover
      // then first paints at the stale pre-scroll position and visibly jumps.
      // The mask is down here, so there is nothing to animate for anyway.
      el.scrollIntoView({
        behavior: 'instant',
        block: step.scrollBlock ?? 'start',
        inline: step.scrollInline ?? 'nearest',
      })
      await waitForPosition(el)
      if (!isRunning.value)
        return

      // Two-phase reveal — the user's required order: surface → spotlight →
      // message. driver.js positions the popover exactly ONCE, at highlight
      // time. Putting up the mask can itself reflow the page (a vertically
      // centered dialog re-centers under the overlay; scrollbar suppression
      // shifts it sideways), so a popover attached in the same call is pinned to
      // the pre-mask rect and then visibly jumps. Instead: raise the spotlight
      // alone, let the mask paint and the layout settle beneath it, and only
      // THEN attach the popover — measured against the final, stable rect.
      driverObj = makeDriver()
      driverObj.highlight({ element: el })
      await sleep(pace.gapMs)
      await waitForPosition(el)
      if (driverObj === null || !isRunning.value)
        return
      driverObj.highlight({ element: el, popover: buildPopover(clamped) })
      void refreshAfterMotion(el)
    }
    finally {
      isStaging.value = false
    }
  }

  /** Start (or resume) the tour at `fromStep`. Bypasses the auto-start gate. */
  function startTour(fromStep: number) {
    if (isRunning.value)
      return
    isRunning.value = true
    void goToStep(clamp(fromStep), 1)
  }

  /**
   * Auto-start once at sign-in: only when the gate allows it and not already
   * running. Opens the welcome screen rather than starting straight away (the
   * unprompted tour start was the bad UX). The gate is left untouched and the
   * tour stays down — both are decided by the welcome actions below.
   */
  function maybeStartTour() {
    if (isRunning.value || showWelcome.value || !options.canAutoStart())
      return
    showWelcome.value = true
  }

  /** Welcome "Start tour": engage the tour and stop it auto-popping again. */
  function startFromWelcome() {
    showWelcome.value = false
    options.dismissTourAtSignIn()
    startTour(options.getResumeStep())
  }

  /** Welcome "Skip for now": dismiss the welcome but let it return next sign-in. */
  function skipWelcome() {
    showWelcome.value = false
  }

  /** Welcome "Don't show again": dismiss and flip the gate off for good. */
  function dismissWelcome() {
    showWelcome.value = false
    options.dismissTourAtSignIn()
  }

  return {
    isRunning,
    isStaging,
    showWelcome,
    currentIndex,
    currentTitle,
    totalSteps: steps.length,
    startTour,
    maybeStartTour,
    stop,
    // Welcome-screen actions:
    startFromWelcome,
    skipWelcome,
    dismissWelcome,
    // Banner-driven navigation:
    next: advance,
    back,
    finish: finishDismiss,
  }
}
