import { z } from 'zod'

export const SUPPRESSION_REASONS = ['bounce', 'complaint', 'unsubscribe', 'manual', 'imported'] as const

export const suppressionReasonSchema = z.enum(SUPPRESSION_REASONS)

export const createSuppressionSchema = z.object({
  email: z.string().email('Valid email is required'),
  reason: suppressionReasonSchema.optional(),
  source: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const bulkSuppressionsSchema = z.object({
  emails: z.array(createSuppressionSchema).min(1).max(1000),
})

export const uploadConfirmSchema = z.object({
  s3Key: z.string().min(1),
  filename: z.string().optional(),
  mapping: z.object({
    email: z.number().min(0, 'Email column is required'),
    reason: z.number().optional(),
    source: z.number().optional(),
  }),
})

export type CreateSuppressionInput = z.infer<typeof createSuppressionSchema>
export type BulkSuppressionsInput = z.infer<typeof bulkSuppressionsSchema>
export type SuppressionUploadConfirmInput = z.infer<typeof uploadConfirmSchema>
