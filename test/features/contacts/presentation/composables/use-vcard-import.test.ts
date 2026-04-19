import { describe, expect, it } from 'vitest'
import { parseVCardText } from '@/features/contacts/presentation/composables/use-vcard-import'

const singleVCard = `BEGIN:VCARD
VERSION:3.0
FN:Max Muster
N:Muster;Max;;;
TEL;TYPE=CELL:+41 79 123 45 67
END:VCARD`

const multiVCard = `BEGIN:VCARD
VERSION:3.0
FN:Anna Bauer
N:Bauer;Anna;;;
TEL:079 111 22 33
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Bob
END:VCARD`

const noPhoneVCard = `BEGIN:VCARD
VERSION:3.0
FN:Lisa Müller
N:Müller;Lisa;;;
END:VCARD`

const fnOnlyVCard = `BEGIN:VCARD
VERSION:4.0
FN:Thomas von Burg
END:VCARD`

const telWithTypeVCard = `BEGIN:VCARD
VERSION:3.0
FN:Test User
TEL;TYPE=WORK,VOICE:+41 44 555 66 77
END:VCARD`

describe('parseVCardText', () => {
  it('should parse single vCard with FN and N', () => {
    const result = parseVCardText(singleVCard)
    expect(result).toHaveLength(1)
    expect(result[0]!.firstName).toBe('Max')
    expect(result[0]!.lastName).toBe('Muster')
    expect(result[0]!.phones).toHaveLength(1)
    expect(result[0]!.phones[0]).toEqual({
      value: '+41 79 123 45 67',
      label: 'Mobile',
      isPrimary: true,
    })
  })

  it('should parse multiple vCard blocks and normalize phone numbers', () => {
    const result = parseVCardText(multiVCard)
    expect(result).toHaveLength(2)
    expect(result[0]!.firstName).toBe('Anna')
    expect(result[0]!.lastName).toBe('Bauer')
    expect(result[0]!.phones[0]!.value).toBe('+41 79 111 22 33')
    expect(result[0]!.phones[0]!.isPrimary).toBe(true)
    expect(result[1]!.firstName).toBe('Bob')
    expect(result[1]!.phones).toHaveLength(0)
  })

  it('should return empty phones array when no TEL field', () => {
    const result = parseVCardText(noPhoneVCard)
    expect(result[0]!.phones).toHaveLength(0)
  })

  it('should use FN field when N field absent', () => {
    const result = parseVCardText(fnOnlyVCard)
    expect(result[0]!.firstName).toBe('Thomas')
    expect(result[0]!.lastName).toBe('von Burg')
  })

  it('should parse TEL field with type parameters and derive label', () => {
    const result = parseVCardText(telWithTypeVCard)
    expect(result[0]!.phones[0]!.value).toBe('+41 44 555 66 77')
    expect(result[0]!.phones[0]!.label).toBe('Work')
  })

  it('should return empty array for text with no vCards', () => {
    expect(parseVCardText('no vcard here')).toHaveLength(0)
  })

  it('should prefer N field over FN for name', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Wrong Name
N:Correct;Also;;;
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.firstName).toBe('Also')
    expect(result[0]!.lastName).toBe('Correct')
  })

  it('normalizes Swiss national phone number', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Test
TEL:0791234567
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[0]!.value).toBe('+41 79 123 45 67')
  })

  it('retains unparseable phone number as-is', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Test
TEL:ext. 1234
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[0]!.value).toBe('ext. 1234')
  })

  it('extracts multiple phones with correct labels', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Multi
TEL;TYPE=CELL:+41 79 123 45 67
TEL;TYPE=HOME:+41 44 222 33 44
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones).toHaveLength(2)
    expect(result[0]!.phones[0]).toEqual({
      value: '+41 79 123 45 67',
      label: 'Mobile',
      isPrimary: true,
    })
    expect(result[0]!.phones[1]).toEqual({
      value: '+41 44 222 33 44',
      label: 'Home',
      isPrimary: false,
    })
  })

  it('vCard 3.0 PREF marker selects primary', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Pref Test
TEL;TYPE=CELL:+41 79 123 45 67
TEL;TYPE=HOME,PREF:+41 44 222 33 44
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[0]!.isPrimary).toBe(false)
    expect(result[0]!.phones[1]!.isPrimary).toBe(true)
  })

  it('vCard 4.0 PREF parameter selects primary', () => {
    const vcard = `BEGIN:VCARD
VERSION:4.0
FN:Pref4 Test
TEL;TYPE=CELL:+41 79 123 45 67
TEL;TYPE=HOME;PREF=1:+41 44 222 33 44
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[1]!.isPrimary).toBe(true)
    expect(result[0]!.phones[0]!.isPrimary).toBe(false)
  })

  it('no PREF: CELL wins over HOME and WORK regardless of order', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Cell Priority
TEL;TYPE=HOME:+41 44 222 33 44
TEL;TYPE=WORK:+41 44 555 66 77
TEL;TYPE=CELL:+41 79 123 45 67
END:VCARD`
    const result = parseVCardText(vcard)
    const primary = result[0]!.phones.find(p => p.isPrimary)
    expect(primary?.label).toBe('Mobile')
  })

  it('no PREF and no CELL: HOME wins over WORK', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Home Priority
TEL;TYPE=WORK:+41 44 555 66 77
TEL;TYPE=HOME:+41 44 222 33 44
END:VCARD`
    const result = parseVCardText(vcard)
    const primary = result[0]!.phones.find(p => p.isPrimary)
    expect(primary?.label).toBe('Home')
  })

  it('no PREF, CELL, HOME, or WORK: first TEL is primary', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:First Fallback
TEL:+41 44 111 22 33
TEL:+41 44 444 55 66
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[0]!.isPrimary).toBe(true)
    expect(result[0]!.phones[1]!.isPrimary).toBe(false)
  })

  it('unrecognised TYPE yields null label', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Fax Test
TEL;TYPE=FAX:+41 44 222 33 44
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[0]!.label).toBeNull()
  })

  it('single phone contact has isPrimary true', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Single
TEL;TYPE=CELL:+41 79 123 45 67
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phones[0]!.isPrimary).toBe(true)
  })

  it('iOS TYPE=iPhone treated as CELL wins over WORK', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:iOS User
TEL;type=WORK;type=VOICE:+41 44 555 66 77
TEL;type=iPhone;type=CELL;type=VOICE:+41 79 123 45 67
END:VCARD`
    const result = parseVCardText(vcard)
    const primary = result[0]!.phones.find(p => p.isPrimary)
    expect(primary?.value).toBe('+41 79 123 45 67')
    expect(primary?.label).toBe('Mobile')
  })

  it('iOS TYPE=iPhone only (no CELL) treated as mobile, wins over WORK', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:iOS User2
TEL;type=WORK;type=VOICE:+41 44 555 66 77
TEL;type=iPhone;type=VOICE:+41 79 123 45 67
END:VCARD`
    const result = parseVCardText(vcard)
    const primary = result[0]!.phones.find(p => p.isPrimary)
    expect(primary?.value).toBe('+41 79 123 45 67')
  })
})
