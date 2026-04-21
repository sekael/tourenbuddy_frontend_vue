import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useFormatter() {
  const { locale } = useI18n({ useScope: 'global' })

  const formatDate = computed(
    () =>
      (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string =>
        new Intl.DateTimeFormat(locale.value, options).format(new Date(date)),
  )

  const formatNumber = computed(
    () =>
      (value: number, options?: Intl.NumberFormatOptions): string =>
        new Intl.NumberFormat(locale.value, options).format(value),
  )

  return { formatDate, formatNumber }
}
