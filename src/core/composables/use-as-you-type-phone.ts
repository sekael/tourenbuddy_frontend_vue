import type { CountryCode } from 'libphonenumber-js/min'
import type { Ref } from 'vue'
import { AsYouType } from 'libphonenumber-js/min'
import { computed, nextTick } from 'vue'

const DEFAULT_COUNTRY: CountryCode = 'CH'

/** Count digits and the leading '+' sign (significant phone chars for caret tracking). */
function countSignificantChars(s: string): number {
  let count = 0
  for (const ch of s) {
    if (/\d/.test(ch) || ch === '+') count++
  }
  return count
}

function findCursorAfterNthSignificantChar(s: string, n: number): number {
  if (n <= 0) return 0
  let count = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!
    if (/\d/.test(ch) || ch === '+') {
      count++
      if (count === n) return i + 1
    }
  }
  return s.length
}

/**
 * Composable that applies live as-you-type international phone formatting to an input.
 *
 * Usage:
 * ```ts
 * const raw = ref('')
 * const { formatted, onInput } = useAsYouTypePhone(raw)
 * ```
 * ```html
 * <input :value="formatted" @input="onInput" type="tel" />
 * ```
 *
 * The `raw` ref is updated on every keystroke. The displayed value is formatted
 * progressively by libphonenumber-js AsYouType (default region: CH). Caret position
 * is preserved relative to the digits typed.
 */
export function useAsYouTypePhone(
  rawRef: Ref<string>,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
) {
  const formatted = computed(() => {
    if (!rawRef.value) return ''
    return new AsYouType(defaultCountry).input(rawRef.value)
  })

  function onInput(event: Event) {
    const input = event.target as HTMLInputElement
    const newValue = input.value
    const cursorBefore = input.selectionStart ?? newValue.length

    const sigCharsBeforeCursor = countSignificantChars(newValue.slice(0, cursorBefore))

    // Update rawRef — triggers reactive recompute of `formatted`
    rawRef.value = newValue

    nextTick(() => {
      // After Vue updates the DOM via :value="formatted", restore caret position
      const currentFormatted = input.value
      const newCursor = findCursorAfterNthSignificantChar(currentFormatted, sigCharsBeforeCursor)
      input.setSelectionRange(newCursor, newCursor)
    })
  }

  return { formatted, onInput }
}
