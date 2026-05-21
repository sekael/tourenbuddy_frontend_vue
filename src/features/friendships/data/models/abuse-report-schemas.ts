import { z } from 'zod'

export const abuseReportSchema = z.object({
  reportedUserId: z.string().uuid(),
  reason: z.string().max(1000).nullable(),
})

export type AbuseReport = z.infer<typeof abuseReportSchema>
