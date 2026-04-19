import type { ParsedName } from '@/features/contacts/core/utils/parse-contact-name'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { parseContactName } from '@/features/contacts/core/utils/parse-contact-name'

export interface VCardPhone {
  value: string
  label: string | null
  isPrimary: boolean
}

export interface VCardContact extends ParsedName {
  phones: VCardPhone[]
}

function parseTelTypes(params: string): string[] {
  const types: string[] = []
  for (const match of params.matchAll(/TYPE=([^;:\r\n]+)/gi)) {
    for (const t of match[1]!.split(',')) types.push(t.trim().toUpperCase())
  }
  return types
}

function deriveTelLabel(types: string[]): string | null {
  const known = types.filter(t =>
    ['CELL', 'HOME', 'WORK', 'VOICE', 'FAX', 'PAGER', 'PREF', 'OTHER'].includes(t),
  )
  const relevant = known.filter(t => t !== 'VOICE' && t !== 'PREF')
  if (relevant.length === 0)
    return null
  const display = relevant
    .map((t) => {
      if (t === 'CELL')
        return 'Mobile'
      if (t === 'HOME')
        return 'Home'
      if (t === 'WORK')
        return 'Work'
      return null
    })
    .filter(Boolean) as string[]
  return display.length > 0 ? display.join('/') : null
}

function parsePrefValue(params: string): number | null {
  const v4Match = params.match(/(?:^|;)PREF=(\d+)/i)
  if (v4Match)
    return Number.parseInt(v4Match[1]!, 10)
  return null
}

function hasPrefV3(types: string[]): boolean {
  return types.includes('PREF')
}

/**
 * Parses vCard 3.0/4.0 format text into structured contacts.
 * Exported for unit testing.
 */
export function parseVCardText(text: string): VCardContact[] {
  const blocks = text.split(/BEGIN:VCARD/i).slice(1)
  return blocks.map((block) => {
    const end = block.indexOf('END:VCARD')
    const content = end !== -1 ? block.slice(0, end) : block

    // Extract name: prefer structured N field then FN
    const nMatch = content.match(/^N(?:;[^:]*)?:([^\r\n]*)/im)
    const fnMatch = content.match(/^FN(?:;[^:]*)?:([^\r\n]*)/im)

    let firstName = ''
    let lastName: string | null = null

    if (nMatch?.[1]) {
      const parts = nMatch[1].split(';')
      const lastPart = parts[0]?.trim() ?? ''
      const firstPart = parts[1]?.trim() ?? ''
      if (firstPart) {
        firstName = firstPart
        lastName = lastPart || null
      }
      else if (lastPart) {
        const parsed = parseContactName(lastPart)
        firstName = parsed.firstName
        lastName = parsed.lastName
      }
    }

    if (!firstName && fnMatch?.[1]) {
      const parsed = parseContactName(fnMatch[1].trim())
      firstName = parsed.firstName
      lastName = parsed.lastName
    }

    // Extract all TEL entries
    interface RawPhone {
      rawValue: string
      params: string
      types: string[]
      prefV4: number | null
      hasPrefV3: boolean
    }

    const rawPhones: RawPhone[] = []
    for (const m of content.matchAll(/^(TEL(?:;[^:]*)?):([^\r\n]*)/gim)) {
      const paramStr = m[1]!
      const rawValue = m[2]!.trim()
      const types = parseTelTypes(paramStr)
      rawPhones.push({
        rawValue,
        params: paramStr,
        types,
        prefV4: parsePrefValue(paramStr),
        hasPrefV3: hasPrefV3(types),
      })
    }

    if (rawPhones.length === 0)
      return { firstName: firstName || 'Unknown', lastName, phones: [] }

    // Determine primary index using precedence:
    // 1. PREF marker (v3 TYPE=PREF or v4 PREF=, lowest numeric wins)
    // 2. first CELL
    // 3. first HOME
    // 4. first WORK
    // 5. first TEL in document order
    let primaryIndex = -1

    const v3PrefIdx = rawPhones.findIndex(p => p.hasPrefV3)
    const v4PrefCandidates = rawPhones
      .map((p, i) => ({ i, pref: p.prefV4 }))
      .filter(x => x.pref !== null)
      .sort((a, b) => a.pref! - b.pref!)

    if (v4PrefCandidates.length > 0) {
      primaryIndex = v4PrefCandidates[0]!.i
    }
    else if (v3PrefIdx !== -1) {
      primaryIndex = v3PrefIdx
    }

    if (primaryIndex === -1) {
      const cellIdx = rawPhones.findIndex(p => p.types.includes('CELL'))
      if (cellIdx !== -1)
        primaryIndex = cellIdx
    }
    if (primaryIndex === -1) {
      const homeIdx = rawPhones.findIndex(p => p.types.includes('HOME'))
      if (homeIdx !== -1)
        primaryIndex = homeIdx
    }
    if (primaryIndex === -1) {
      const workIdx = rawPhones.findIndex(p => p.types.includes('WORK'))
      if (workIdx !== -1)
        primaryIndex = workIdx
    }
    if (primaryIndex === -1)
      primaryIndex = 0

    const phones: VCardPhone[] = rawPhones.map((p, i) => {
      const normalized = normalizePhone(p.rawValue)
      const value = normalized.ok ? normalized.value : p.rawValue
      return {
        value,
        label: deriveTelLabel(p.types),
        isPrimary: i === primaryIndex,
      }
    })

    return { firstName: firstName || 'Unknown', lastName, phones }
  })
}

/** Composable for importing contacts from vCard (.vcf) files. */
export function useVCardImport() {
  async function parseVCardFile(file: File): Promise<VCardContact[]> {
    const text = await file.text()
    return parseVCardText(text)
  }

  return { parseVCardFile }
}
