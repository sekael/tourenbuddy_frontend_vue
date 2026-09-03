import type { MaybeRefOrGetter } from 'vue'

/**
 * Suppresses document scroll while held, by putting `scroll-locked` on <html>
 * (rule in `app/theme/global.css`).
 *
 * Two shapes:
 * - `useScrollLock()` — locked for the caller's whole mounted lifetime. Used by
 *   the map route, which must never scroll the document: any residual scroll
 *   slides the map canvas out from under the location picker's crosshair.
 * - `useScrollLock(getter)` — follows a reactive boolean. Used by the calendar
 *   route for the onboarding tour, whose viewport-fixed spotlight drifts off its
 *   target if the page moves underneath it.
 *
 * Both shapes release on unmount, so no caller writes teardown itself.
 *
 * ponytail: the refcount is not load-bearing today — `patch()` unmounts the old
 * route before mounting the new one (`runtime-core.cjs.js:5376-5379`) and
 * `App.vue`'s <RouterView> has no <Transition> to defer that, so two holders
 * never coexist. It guards the day someone adds one: a boolean toggle would then
 * let a leaving page strip the lock an arriving page just took, and that failure
 * is invisible in tests (happy-dom has no rubber-band) — it resurfaces as #247
 * on a device.
 */

// TODO(me): implement the refcounted lock.
//   See task list at the end of this response.
export function useScrollLock(_active?: MaybeRefOrGetter<boolean>): void {}
