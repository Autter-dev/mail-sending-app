import { z } from 'zod'

const blockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'text', 'image', 'button', 'divider', 'spacer']),
  props: z.record(z.unknown()),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  fromCampaignId: z.string().uuid().optional(),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  subject: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().optional(),
  templateJson: z.array(blockSchema).optional(),
  templateHtml: z.string().nullable().optional(),
})

export const useTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  listId: z.string().uuid(),
})

export const saveAsTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
})

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type UseTemplateInput = z.infer<typeof useTemplateSchema>
export type SaveAsTemplateInput = z.infer<typeof saveAsTemplateSchema>
