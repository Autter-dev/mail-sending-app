import { z } from 'zod'

export const createProviderSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['resend', 'ses'], { required_error: 'Type must be resend or ses' }),
  apiKey: z.string().min(1, 'API key is required'),
  region: z.string().optional(),
  rateLimitPerSecond: z.number().int().min(1).max(1000).optional(),
})

export type CreateProviderInput = z.infer<typeof createProviderSchema>
