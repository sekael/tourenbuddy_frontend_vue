import type { CountryCode } from 'libphonenumber-js/min'
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

const DEFAULT_REGION: CountryCode = 'CH'

export type PhoneNormalizeResult = { ok: true; value: string } | { ok: false; raw: string }

/**
 * Parses a phone number string against the given default region (default: CH).
 *
 * Returns `{ ok: true, value }` with the canonical international form (e.g. "+41 79 012 34 56")
 * or `{ ok: false, raw }` when the input cannot be parsed or is empty.
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_REGION,
): PhoneNormalizeResult {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return { ok: false, raw: '' }

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry)
  if (!parsed || !parsed.isValid()) return { ok: false, raw: trimmed }

  return { ok: true, value: parsed.formatInternational() }
}

/**
 * Returns the E.164 form (e.g. "+41791234567") for transport layers requiring it (Supabase Auth).
 * Returns null when the input cannot be parsed.
 */
export function toE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_REGION,
): string | null {
  const trimmed = (input ?? '').trim()
  if (!trimmed) return null

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry)
  if (!parsed || !parsed.isValid()) return null

  return parsed.format('E.164')
}
