import { z } from 'zod'

export const supportedLocaleCodeSchema = z.enum(['en', 'de-CH'])
export type SupportedLocaleCode = z.infer<typeof supportedLocaleCodeSchema>

/** Zod schema for a user profile row from the `user_profile` Supabase table. */
export const userProfileSchema = z.object({
  id: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  locale: supportedLocaleCodeSchema.nullable(),
  // Onboarding tour state (see migration add_onboarding_tour_state).
  onboardingTourShowAtSignIn: z.boolean(),
  onboardingTourLastStep: z.number().int(),
})

/** Raw shape returned from Supabase (snake_case). */
export const userProfileRowSchema = z
  .object({
    id: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    locale: supportedLocaleCodeSchema.nullish().transform(v => v ?? null),
    // Defaulted so rows predating the columns (and test fixtures) still parse;
    // the live DB always returns them (NOT NULL defaults).
    onboarding_tour_show_at_sign_in: z.boolean().default(true),
    onboarding_tour_last_step: z.number().int().default(0),
  })
  .transform(row => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    locale: row.locale,
    onboardingTourShowAtSignIn: row.onboarding_tour_show_at_sign_in,
    onboardingTourLastStep: row.onboarding_tour_last_step,
  }))
