import type { ParsedName } from '@/features/contacts/core/utils/parse-contact-name'
import { normalizePhone } from '@/core/utils/phone-normalize'
import { dedupeEmails, dedupePhones, dedupeRawPhones } from '@/features/contacts/core/utils/dedupe'
import { parseContactName } from '@/features/contacts/core/utils/parse-contact-name'

export interface VCardPhone {
  value: string
  label: string | null
  isPrimary: boolean
}

export interface VCardContact extends ParsedName {
  phones: VCardPhone[]
  rawPhoneNumbers: string[]
  emails: string[]
}

function parseTelTypes(params: string): string[] {
  const seen = new Set<string>()
  for (const match of params.matchAll(/TYPE=([^;:\r\n]+)/gi)) {
    for (const t of match[1]!.split(',')) {
      const upper = t.trim().toUpperCase()
      // iOS exports TYPE=iPhone (without TYPE=CELL) — treat as CELL
      seen.add(upper === 'IPHONE' ? 'CELL' : upper)
    }
  }
  return [...seen]
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

    // Extract EMAIL entries
    const emailValues: string[] = []
    for (const m of content.matchAll(/^EMAIL(?:;[^:]*)?:([^\r\n]*)/gim)) {
      const raw = m[1]!.trim()
      if (raw)
        emailValues.push(raw)
    }
    const emails = dedupeEmails(emailValues)

    if (rawPhones.length === 0)
      return { firstName: firstName || 'Unknown', lastName, phones: [], rawPhoneNumbers: [], emails }

    // Normalize phones; route unparseable values to rawPhoneNumbers only
    interface ParsedPhone {
      value: string
      label: string | null
      originalIndex: number
      prefV4: number | null
      hasPrefV3: boolean
      types: string[]
    }

    const parsedPhones: ParsedPhone[] = []
    const rawPhoneNumbers: string[] = []

    for (let i = 0; i < rawPhones.length; i++) {
      const p = rawPhones[i]!
      const normalized = normalizePhone(p.rawValue)
      if (normalized.ok) {
        parsedPhones.push({
          value: normalized.e164,
          label: deriveTelLabel(p.types),
          originalIndex: i,
          prefV4: p.prefV4,
          hasPrefV3: p.hasPrefV3,
          types: p.types,
        })
      }
      else if (p.rawValue) {
        rawPhoneNumbers.push(p.rawValue)
      }
    }

    // Dedupe before primary-resolution so PREF/CELL/HOME/WORK runs on a unique set
    const dedupedPhones = dedupePhones(parsedPhones)
    const dedupedRaw = dedupeRawPhones(rawPhoneNumbers)

    if (dedupedPhones.length === 0)
      return { firstName: firstName || 'Unknown', lastName, phones: [], rawPhoneNumbers: dedupedRaw, emails }

    // Determine primary using PREF markers then type priority
    const v4PrefCandidates = dedupedPhones
      .filter(p => p.prefV4 !== null)
      .sort((a, b) => a.prefV4! - b.prefV4!)
    const v3PrefIdx = dedupedPhones.findIndex(p => p.hasPrefV3)

    let primaryParsedIdx = -1
    if (v4PrefCandidates.length > 0) {
      primaryParsedIdx = dedupedPhones.indexOf(v4PrefCandidates[0]!)
    }
    else if (v3PrefIdx !== -1) {
      primaryParsedIdx = v3PrefIdx
    }

    if (primaryParsedIdx === -1) {
      const cellIdx = dedupedPhones.findIndex(p => p.types.includes('CELL'))
      if (cellIdx !== -1)
        primaryParsedIdx = cellIdx
    }
    if (primaryParsedIdx === -1) {
      const homeIdx = dedupedPhones.findIndex(p => p.types.includes('HOME'))
      if (homeIdx !== -1)
        primaryParsedIdx = homeIdx
    }
    if (primaryParsedIdx === -1) {
      const workIdx = dedupedPhones.findIndex(p => p.types.includes('WORK'))
      if (workIdx !== -1)
        primaryParsedIdx = workIdx
    }
    if (primaryParsedIdx === -1)
      primaryParsedIdx = 0

    const phones: VCardPhone[] = dedupedPhones.map((p, i) => ({
      value: p.value,
      label: p.label,
      isPrimary: i === primaryParsedIdx,
    }))

    return { firstName: firstName || 'Unknown', lastName, phones, rawPhoneNumbers: dedupedRaw, emails }
  })
}

/** Composable for importing contacts from vCard (.vcf) files. */
export function useVCardImport() {
  async function parseVCardFile(file: File): Promise<VCardContact[]> {
    const text = await file.text()
    return parseVCardText(text)
  }

  async function parseVCardFiles(files: File[]): Promise<VCardContact[]> {
    if (files.length !== 1)
      throw new Error('Exactly one .vcf file must be provided')
    return parseVCardFile(files[0]!)
  }

  return { parseVCardFile, parseVCardFiles }
}
