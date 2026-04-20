import { describe, expect, it } from 'vitest'
import {
  buildContactActions,
  buildGroupSmsRecipients,
} from '@/features/contacts/core/utils/contact-actions'

function makeContact(
  id: string,
  methods: Array<{
    id: string
    value: string
    isPrimary: boolean
    isValid?: boolean
    label?: string | null
  }>,
) {
  return {
    id,
    userId: 'u1',
    firstName: 'Test',
    lastName: null,
    displayName: null,
    contactMethods: methods.map((m) => ({
      id: m.id,
      contactId: id,
      methodType: 'phone' as const,
      value: m.value,
      label: m.label ?? null,
      isPrimary: m.isPrimary,
      isValid: m.isValid ?? true,
    })),
  }
}

describe('buildContactActions', () => {
  it('returns action for single valid E.164 method', () => {
    const contact = makeContact('c1', [{ id: 'm1', value: '+41791234567', isPrimary: true }])
    const actions = buildContactActions(contact)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.call).toBe('tel:+41791234567')
    expect(actions[0]!.whatsApp).toBe('https://wa.me/41791234567')
    expect(actions[0]!.methodId).toBe('m1')
  })

  it('returns multiple actions ordered primary-first', () => {
    const contact = makeContact('c1', [
      { id: 'm1', value: '+41791111111', isPrimary: false },
      { id: 'm2', value: '+41792222222', isPrimary: true },
    ])
    const actions = buildContactActions(contact)
    expect(actions).toHaveLength(2)
    expect(actions[0]!.methodId).toBe('m2')
    expect(actions[1]!.methodId).toBe('m1')
  })

  it('omits invalid methods (isValid=false)', () => {
    const contact = makeContact('c1', [
      { id: 'm1', value: '+41791234567', isPrimary: true, isValid: false },
    ])
    expect(buildContactActions(contact)).toHaveLength(0)
  })

  it('omits non-E.164 values even when isValid=true', () => {
    const contact = makeContact('c1', [
      { id: 'm1', value: '079 123 45 67', isPrimary: true, isValid: true },
    ])
    expect(buildContactActions(contact)).toHaveLength(0)
  })

  it('returns empty array for contact with no phones', () => {
    const contact = {
      id: 'c1',
      userId: 'u1',
      firstName: 'Test',
      lastName: null,
      displayName: null,
      contactMethods: [],
    }
    expect(buildContactActions(contact)).toHaveLength(0)
  })

  it('returns only valid methods in mixed valid+invalid list', () => {
    const contact = makeContact('c1', [
      { id: 'm1', value: '+41791234567', isPrimary: true, isValid: true },
      { id: 'm2', value: '079 bad', isPrimary: false, isValid: false },
    ])
    const actions = buildContactActions(contact)
    expect(actions).toHaveLength(1)
    expect(actions[0]!.methodId).toBe('m1')
  })

  it('uses method label when available', () => {
    const contact = makeContact('c1', [
      { id: 'm1', value: '+41791234567', isPrimary: true, label: 'Mobile' },
    ])
    expect(buildContactActions(contact)[0]!.label).toBe('Mobile')
  })
})

describe('buildGroupSmsRecipients', () => {
  it('includes contact with valid primary E.164 phone', () => {
    const p = makeContact('c1', [{ id: 'm1', value: '+41791234567', isPrimary: true }])
    const result = buildGroupSmsRecipients([p])
    expect(result.included).toHaveLength(1)
    expect(result.included[0]!.e164).toBe('+41791234567')
    expect(result.excluded).toHaveLength(0)
  })

  it('excludes contact with no phones', () => {
    const p = {
      id: 'c1',
      userId: 'u1',
      firstName: 'Test',
      lastName: null,
      displayName: null,
      contactMethods: [],
    }
    const result = buildGroupSmsRecipients([p])
    expect(result.included).toHaveLength(0)
    expect(result.excluded).toHaveLength(1)
    expect(result.excluded[0]!.reason).toBeTruthy()
  })

  it('excludes contact with invalid primary phone', () => {
    const p = makeContact('c1', [{ id: 'm1', value: '079 bad', isPrimary: true, isValid: false }])
    const result = buildGroupSmsRecipients([p])
    expect(result.included).toHaveLength(0)
    expect(result.excluded).toHaveLength(1)
  })

  it('handles mixed valid+invalid contacts', () => {
    const valid = makeContact('c1', [{ id: 'm1', value: '+41791111111', isPrimary: true }])
    const invalid = makeContact('c2', [{ id: 'm2', value: 'bad', isPrimary: true, isValid: false }])
    const result = buildGroupSmsRecipients([valid, invalid])
    expect(result.included).toHaveLength(1)
    expect(result.excluded).toHaveLength(1)
  })

  it('composes comma-separated E.164 numbers for two recipients', () => {
    const p1 = makeContact('c1', [{ id: 'm1', value: '+41791111111', isPrimary: true }])
    const p2 = makeContact('c2', [{ id: 'm2', value: '+41792222222', isPrimary: true }])
    const result = buildGroupSmsRecipients([p1, p2])
    const uri = `sms:${result.included.map((r) => r.e164).join(',')}`
    expect(uri).toBe('sms:+41791111111,+41792222222')
  })
})
