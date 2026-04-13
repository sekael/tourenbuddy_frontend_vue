import type { ParsedName } from '@/features/contacts/core/utils/parse-contact-name'
import { parseContactName } from '@/features/contacts/core/utils/parse-contact-name'

export interface VCardContact extends ParsedName {
  phoneNumber: string | null
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

    // Extract name: prefer structured N field (last;first;middle;prefix;suffix)
    // then fall back to FN (formatted name)
    const nMatch = content.match(/^N(?:;[^:]*)?:([^\r\n]*)/im)
    const fnMatch = content.match(/^FN(?:;[^:]*)?:([^\r\n]*)/im)

    let firstName = ''
    let lastName: string | null = null

    if (nMatch?.[1]) {
      const parts = nMatch[1].split(';')
      // N field: last;first;middle;prefix;suffix
      const lastPart = parts[0]?.trim() ?? ''
      const firstPart = parts[1]?.trim() ?? ''
      if (firstPart) {
        firstName = firstPart
        lastName = lastPart || null
      }
      else if (lastPart) {
        // Fallback if first is empty but last is present
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

    // Extract phone: first TEL field value
    const telMatch = content.match(/^TEL(?:;[^:]*)?:([^\r\n]*)/im)
    const phoneNumber = telMatch?.[1]?.trim() || null

    return { firstName: firstName || 'Unknown', lastName, phoneNumber }
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
