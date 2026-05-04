import { z } from 'zod'

const optionalEmail = z
  .union([z.string().trim().email('Must be a valid email'), z.literal(''), z.null()])
  .transform((v) => (v === '' || v === null ? null : v))
  .optional()

const optionalName = z
  .union([z.string().trim().max(200, 'Must be 200 characters or fewer'), z.literal(''), z.null()])
  .transform((v) => (v === '' || v === null ? null : v))
  .optional()

export const updateAppSettingsSchema = z.object({
  confirmationFromEmail: optionalEmail,
  confirmationFromName: optionalName,
})

export type UpdateAppSettingsInput = z.infer<typeof updateAppSettingsSchema>
