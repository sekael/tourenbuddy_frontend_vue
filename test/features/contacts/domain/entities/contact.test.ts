import { describe, expect, it } from 'vitest'
import { formatPhoneDisplay } from '@/features/contacts/domain/entities/contact'

describe('formatPhoneDisplay', () => {
  it('normalizes legacy 00-prefix to canonical international form', () => {
    expect(formatPhoneDisplay('0041791234567')).toBe('+41 79 123 45 67')
  })

  it('normalizes legacy local Swiss number', () => {
    expect(formatPhoneDisplay('0791234567')).toBe('+41 79 123 45 67')
  })

  it('normalizes already-canonical form (idempotent)', () => {
    expect(formatPhoneDisplay('+41 79 123 45 67')).toBe('+41 79 123 45 67')
  })

  it('normalizes unspaced E.164 form', () => {
    expect(formatPhoneDisplay('+41791234567')).toBe('+41 79 123 45 67')
  })

  it('falls back to trimmed original for unrecognized values', () => {
    expect(formatPhoneDisplay('ext. 1234')).toBe('ext. 1234')
  })

  it('trims whitespace from unrecognized fallback', () => {
    expect(formatPhoneDisplay('  ext. 1234  ')).toBe('ext. 1234')
  })
})
