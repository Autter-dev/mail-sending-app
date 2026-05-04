import { z } from 'zod'

export const createListSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  requireDoubleOptIn: z.boolean().optional(),
})

export const updateListSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().nullable().optional(),
  requireDoubleOptIn: z.boolean().optional(),
})

export const uploadConfirmSchema = z.object({
  s3Key: z.string().min(1),
  mapping: z.object({
    email: z.number().min(0, 'Email column is required'),
    firstName: z.number().optional(),
    lastName: z.number().optional(),
    metadata: z.array(z.object({
      column: z.number(),
      key: z.string().min(1),
    })).optional(),
  }),
})

export type CreateListInput = z.infer<typeof createListSchema>
export type UpdateListInput = z.infer<typeof updateListSchema>
export type UploadConfirmInput = z.infer<typeof uploadConfirmSchema>
