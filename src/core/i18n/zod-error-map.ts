import { z } from 'zod'
import { i18n } from './index'

function t(key: string): string {
  return i18n.global.t(key as never)
}

export function installZodErrorMap(): void {
  z.setErrorMap((issue) => {
    switch (issue.code) {
      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined' || issue.received === 'null') {
          return { message: t('validation.required') }
        }
        return { message: t('validation.invalidType') }
      case z.ZodIssueCode.too_small:
        return { message: t('validation.tooSmall') }
      case z.ZodIssueCode.too_big:
        return { message: t('validation.tooBig') }
      case z.ZodIssueCode.invalid_string:
        return { message: t('validation.invalidString') }
      case z.ZodIssueCode.invalid_enum_value:
        return { message: t('validation.invalidEnum') }
      default:
        return { message: t('validation.invalid') }
    }
  })
}
