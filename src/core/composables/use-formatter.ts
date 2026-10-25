import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useFormatter() {
  const { locale } = useI18n({ useScope: 'global' })

  const formatDate = computed(
    () =>
      (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string =>
        new Intl.DateTimeFormat(locale.value, options).format(new Date(date)),
  )

  /** `start`–`end` with the shared parts collapsed per locale; a single day when they match. */
  const formatDateRange = computed(
    () =>
      (start: Date, end: Date, options?: Intl.DateTimeFormatOptions): string => {
        const fmt = new Intl.DateTimeFormat(locale.value, options)
        return start.getTime() === end.getTime() ? fmt.format(start) : fmt.formatRange(start, end)
      },
  )

  const formatNumber = computed(
    () =>
      (value: number, options?: Intl.NumberFormatOptions): string =>
        new Intl.NumberFormat(locale.value, options).format(value),
  )

  /** A height as swisstopo and SAC write it: whole metres, no separator, no-break space — "3079 m". */
  const formatElevation = computed(
    () =>
      (metres: number): string =>
        `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0, useGrouping: false }).format(metres)}\u00A0m`,
  )

  /** Horizontal distance in kilometres to one decimal — "8.4 km". */
  const formatDistance = computed(
    () =>
      (metres: number): string =>
        `${new Intl.NumberFormat(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(metres / 1000)}\u00A0km`,
  )

  return { formatDate, formatDateRange, formatNumber, formatElevation, formatDistance }
}
