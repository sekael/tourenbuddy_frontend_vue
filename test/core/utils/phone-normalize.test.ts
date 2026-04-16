import { describe, expect, it } from 'vitest'
import { normalizePhone, toE164 } from '@/core/utils/phone-normalize'

describe('normalizePhone', () => {
  it('normalizes Swiss national number', () => {
    const result = normalizePhone('0791234567')
    expect(result).toEqual({ ok: true, value: '+41 79 123 45 67' })
  })

  it('normalizes Swiss national number with spaces', () => {
    const result = normalizePhone('079 123 45 67')
    expect(result).toEqual({ ok: true, value: '+41 79 123 45 67' })
  })

  it('normalizes plus-prefixed E.164 number', () => {
    const result = normalizePhone('+41791234567')
    expect(result).toEqual({ ok: true, value: '+41 79 123 45 67' })
  })

  it('normalizes plus-prefixed number with spaces', () => {
    const result = normalizePhone('+41 79 123 45 67')
    expect(result).toEqual({ ok: true, value: '+41 79 123 45 67' })
  })

  it('normalizes 00-prefixed international number', () => {
    const result = normalizePhone('0041 79 123 45 67')
    expect(result).toEqual({ ok: true, value: '+41 79 123 45 67' })
  })

  it('normalizes foreign number with country code', () => {
    const result = normalizePhone('+33 6 12 34 56 78')
    expect(result).toEqual({ ok: true, value: '+33 6 12 34 56 78' })
  })

  it('normalizes foreign national number with override region', () => {
    const result = normalizePhone('0612345678', 'FR')
    expect(result).toEqual({ ok: true, value: '+33 6 12 34 56 78' })
  })

  it('returns ok: false for unparseable input', () => {
    const result = normalizePhone('not a number')
    expect(result).toEqual({ ok: false, raw: 'not a number' })
  })

  it('returns ok: false for empty string', () => {
    const result = normalizePhone('')
    expect(result).toEqual({ ok: false, raw: '' })
  })

  it('returns ok: false for whitespace-only string', () => {
    const result = normalizePhone('   ')
    expect(result).toEqual({ ok: false, raw: '' })
  })

  it('returns ok: false for null', () => {
    const result = normalizePhone(null)
    expect(result).toEqual({ ok: false, raw: '' })
  })

  it('returns ok: false for undefined', () => {
    const result = normalizePhone(undefined)
    expect(result).toEqual({ ok: false, raw: '' })
  })

  it('returns ok: false for too-short number', () => {
    const result = normalizePhone('1234')
    expect(result.ok).toBe(false)
  })
})

describe('toE164', () => {
  it('converts canonical international form to E.164', () => {
    expect(toE164('+41 79 123 45 67')).toBe('+41791234567')
  })

  it('converts Swiss national form to E.164', () => {
    expect(toE164('0791234567')).toBe('+41791234567')
  })

  it('converts 00-prefixed form to E.164', () => {
    expect(toE164('0041791234567')).toBe('+41791234567')
  })

  it('returns null for unparseable input', () => {
    expect(toE164('not a number')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(toE164('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(toE164(null)).toBeNull()
  })
})
