import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue
}

function collectKeys(obj: JsonObject, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as JsonObject, fullKey))
    }
    else {
      keys.push(fullKey)
    }
  }
  return keys
}

const root = resolve(import.meta.dirname, '..')
const en = JSON.parse(readFileSync(resolve(root, 'src/locales/en.json'), 'utf8')) as JsonObject
const deCh = JSON.parse(readFileSync(resolve(root, 'src/locales/de-CH.json'), 'utf8')) as JsonObject

const enKeys = new Set(collectKeys(en))
const deChKeys = new Set(collectKeys(deCh))

const missing = [...enKeys].filter(k => !deChKeys.has(k))
const extra = [...deChKeys].filter(k => !enKeys.has(k))

if (extra.length > 0) {
  console.warn(`⚠  de-CH has ${extra.length} extra key(s) not in en.json:`)
  extra.forEach(k => console.warn(`   + ${k}`))
}

if (missing.length > 0) {
  console.error(`✗  de-CH is missing ${missing.length} key(s) from en.json:`)
  missing.forEach(k => console.error(`   - ${k}`))
  process.exit(1)
}

process.stdout.write(`✓  All ${enKeys.size} en.json keys present in de-CH.json\n`)
