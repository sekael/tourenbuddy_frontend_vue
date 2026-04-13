import { z } from 'zod'

/** Enum matching Supabase `contact_method_type`. */
export const contactMethodTypeSchema = z.enum(['phone', 'email'])

/** Raw shape from Supabase `contact_methods` table (snake_case). */
export const contactMethodRowSchema = z
  .object({
    id: z.string(),
    contact_id: z.string(),
    method_type: contactMethodTypeSchema,
    value: z.string(),
    label: z.string().nullable(),
    is_primary: z.boolean(),
  })
  .transform(row => ({
    id: row.id,
    contactId: row.contact_id,
    methodType: row.method_type,
    value: row.value,
    label: row.label,
    isPrimary: row.is_primary,
  }))

/** Domain-level contact method shape (camelCase). */
export const contactMethodSchema = z.object({
  id: z.string(),
  contactId: z.string(),
  methodType: contactMethodTypeSchema,
  value: z.string(),
  label: z.string().nullable(),
  isPrimary: z.boolean(),
})
