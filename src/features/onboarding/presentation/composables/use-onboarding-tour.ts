import type { Driver, Popover } from 'driver.js'
import type { OnboardingStep, TourSurface } from '../onboarding-steps'
import { driver } from 'driver.js'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLogger } from '@/core/logging/use-logger'
import { ONBOARDING_STEPS } from '../onboarding-steps'
import 'driver.js/dist/driver.css'

export interface UseOnboardingTourOptions {
  /**
   * Make a step's surface visible (open the right overlay / speed-dial view).
   * May be async — staging an overlay animates it in.
   */
  stage: (surface: TourSurface) => void | Promise<void>
  /** Close whatever the tour opened once it ends. */
  cleanup: () => void
  /** Persist the resume index. Non-blocking (swallows/logs its own errors). */
  saveTourStep: (n: number) => void | Promise<void>
  /** Flip the auto-start gate off. Non-blocking. */
  dismissTourAtSignIn: () => void | Promise<void>
  /** True only when authenticated AND profile loaded AND show-at-sign-in is set. */
  canAutoStart: () => boolean
  /** The persisted resume index (`onboarding_tour_last_step`). */
  getResumeStep: () => number
}

const LAST_INDEX = ONBOARDING_STEPS.length - 1

export function useOnboardingTour(options: UseOnboardingTourOptions) {
  const { t } = useI18n({ useScope: 'global' })
  const logger = useLogger('OnboardingTour')

  const isRunning = ref(false)
  const currentIndex = ref(0)
  let driverObj: Driver | null = null

  const clamp = (i: number) => Math.max(0, Math.min(i, LAST_INDEX))

  /**
   * Resolve the first element matching `selector`, or null if it never appears
   * within `timeoutMs`. A staged overlay animates in (Transition mode="out-in"),
   * so the target is often not in the DOM the instant we stage it.
   */
  function waitForElement(selector: string, timeoutMs = 1000): Promise<Element | null> {
    return new Promise((resolve) => {
      nextTick(() => {
        const existing = document.querySelector(selector)
        if (existing)
          return resolve(existing)

        let timer: ReturnType<typeof setTimeout>

        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector)
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

  /** Advanced past the final step: reset resume point so a reopen replays. */
  function finishCompleted() {
    options.saveTourStep(0)
    teardown()
  }

  /** Next button / backdrop tap. */
  function advance() {
    if (currentIndex.value >= LAST_INDEX) {
      finishCompleted()
      return
    }
    void goToStep(currentIndex.value + 1, 1)
  }

  function back() {
    if (currentIndex.value <= 0)
      return
    void goToStep(currentIndex.value - 1, -1)
  }

  function buildPopover(index: number): Popover {
    const step = ONBOARDING_STEPS[index]
    const isFirst = index === 0
    const isLast = index === LAST_INDEX
    return {
      title: t(step.titleKey),
      description: t(step.bodyKey),
      showButtons: isFirst ? ['next', 'close'] : ['previous', 'next', 'close'],
      nextBtnText: isLast
        ? t('onboarding.tour.controls.done')
        : t('onboarding.tour.controls.next'),
      prevBtnText: t('onboarding.tour.controls.previous'),
      onNextClick: () => advance(),
      onPrevClick: () => back(),
      onCloseClick: () => finishDismiss(),
      // The 'close' button is our persistent dismiss — relabel it "Finish tour".
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = t('onboarding.tour.controls.finish')
      },
    }
  }

  /**
   * Move to `index`, staging its surface and skipping it if the target never
   * shows. `direction` (+1 forward / -1 back) decides which way to skip a
   * missing target so navigation keeps flowing instead of stalling.
   */
  async function goToStep(index: number, direction: 1 | -1) {
    if (!driverObj)
      return
    const clamped = clamp(index)
    currentIndex.value = clamped
    const step: OnboardingStep = ONBOARDING_STEPS[clamped]

    await options.stage(step.surface)
    const el = await waitForElement(step.target)

    // The tour may have been torn down (e.g. "Finish tour" pressed) while we
    // awaited a slow/absent target — bail before touching the dead instance.
    if (!driverObj)
      return

    if (!el) {
      logger.warn(`Onboarding target missing, skipping step ${clamped}: ${step.target}`)
      const next = clamped + direction
      if (next < 0 || next > LAST_INDEX) {
        // Ran off either end while skipping — end without resetting progress.
        finishDismiss()
        return
      }
      await goToStep(next, direction)
      return
    }

    driverObj.highlight({ element: el, popover: buildPopover(clamped) })
  }

  function ensureDriver() {
    driverObj = driver({
      animate: true,
      allowClose: false, // no Esc / backdrop-close; "Finish tour" is the only dismiss
      overlayClickBehavior: () => advance(), // backdrop tap advances
      disableActiveInteraction: true, // highlighted control is inert
      popoverClass: 'onboarding-tour-popover',
    })
  }

  /** Start (or resume) the tour at `fromStep`. Bypasses the auto-start gate. */
  function startTour(fromStep: number) {
    if (isRunning.value)
      return
    isRunning.value = true
    ensureDriver()
    void goToStep(clamp(fromStep), 1)
  }

  /**
   * Auto-start once at sign-in: only when the gate allows it and not already
   * running. Flips the gate off and resumes at the persisted step.
   */
  function maybeStartTour() {
    if (isRunning.value || !options.canAutoStart())
      return
    options.dismissTourAtSignIn()
    startTour(options.getResumeStep())
  }

  return { isRunning, currentIndex, startTour, maybeStartTour }
}
