import { z } from 'zod'

export const inviteRoleEnum = z.enum(['admin', 'member'])
export const expiresInDaysEnum = z.union([z.literal(3), z.literal(7), z.literal(30)])

export const createInviteSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: inviteRoleEnum.default('member'),
  expiresInDays: expiresInDaysEnum.default(7),
})

export const acceptInviteSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().max(120).optional(),
})

export const updateMemberSchema = z.object({
  role: inviteRoleEnum,
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>
