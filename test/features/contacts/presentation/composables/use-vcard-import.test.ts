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
    expect(result[0]).toEqual({
      firstName: 'Max',
      lastName: 'Muster',
      phoneNumber: '+41 79 123 45 67',
    })
  })

  it('should parse multiple vCard blocks and normalize phone numbers', () => {
    const result = parseVCardText(multiVCard)
    expect(result).toHaveLength(2)
    expect(result[0]!.firstName).toBe('Anna')
    expect(result[0]!.lastName).toBe('Bauer')
    expect(result[0]!.phoneNumber).toBe('+41 79 111 22 33')
    expect(result[1]!.firstName).toBe('Bob')
    expect(result[1]!.lastName).toBeNull()
    expect(result[1]!.phoneNumber).toBeNull()
  })

  it('should return null phoneNumber when no TEL field', () => {
    const result = parseVCardText(noPhoneVCard)
    expect(result[0]!.phoneNumber).toBeNull()
  })

  it('should use FN field when N field absent', () => {
    const result = parseVCardText(fnOnlyVCard)
    expect(result[0]!.firstName).toBe('Thomas')
    expect(result[0]!.lastName).toBe('von Burg')
  })

  it('should parse TEL field with type parameters', () => {
    const result = parseVCardText(telWithTypeVCard)
    expect(result[0]!.phoneNumber).toBe('+41 44 555 66 77')
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
    expect(result[0]!.phoneNumber).toBe('+41 79 123 45 67')
  })

  it('retains unparseable phone number as-is', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Test
TEL:ext. 1234
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phoneNumber).toBe('ext. 1234')
  })

  it('leaves phoneNumber null when no TEL field', () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:Test
END:VCARD`
    const result = parseVCardText(vcard)
    expect(result[0]!.phoneNumber).toBeNull()
  })
})
