/**
 * One-time migration: normalize all phone contact_methods rows to E.164.
 *
 * For each phone row:
 * - If the value parses to E.164, UPDATE value = e164 (sets is_valid = true, which is the default)
 * - If the value cannot be parsed, UPDATE is_valid = false (value left unchanged)
 * - If the value is already E.164, skip (no update needed)
 *
 * Run against staging first, verify counts, then run against production.
 * Usage: npx tsx scripts/migrate-phones-to-e164.ts
 */

import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '../src/core/utils/phone-normalize'

const E164_REGEX = /^\+[1-9]\d{1,14}$/

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.warn('Fetching all phone contact methods…')

  const { data: rows, error } = await supabase
    .from('contact_methods')
    .select('id, value, is_valid')
    .eq('method_type', 'phone')

  if (error) {
    console.error('Failed to fetch rows:', error.message)
    process.exit(1)
  }

  console.warn(`Found ${rows.length} phone rows`)

  let updated = 0
  let flagged = 0
  let unchanged = 0

  for (const row of rows) {
    if (E164_REGEX.test(row.value)) {
      unchanged++
      continue
    }

    const result = normalizePhone(row.value)
    if (result.ok) {
      const { error: updateErr } = await supabase
        .from('contact_methods')
        .update({ value: result.e164, is_valid: true })
        .eq('id', row.id)

      if (updateErr) {
        console.error(`Failed to update row ${row.id}:`, updateErr.message)
      } else {
        updated++
      }
    } else {
      const { error: flagErr } = await supabase
        .from('contact_methods')
        .update({ is_valid: false })
        .eq('id', row.id)

      if (flagErr) {
        console.error(`Failed to flag row ${row.id}:`, flagErr.message)
      } else {
        flagged++
      }
    }
  }

  console.warn('Done.')
  console.warn(`  Normalized to E.164: ${updated}`)
  console.warn(`  Flagged as invalid:  ${flagged}`)
  console.warn(`  Already E.164:       ${unchanged}`)
}

main()
