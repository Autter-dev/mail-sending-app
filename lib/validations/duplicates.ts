import { z } from 'zod'

export const mergeGroupSchema = z.object({
  winnerId: z.string().uuid(),
  loserIds: z.array(z.string().uuid()).min(1).max(50),
})

export const mergeGroupsSchema = z.object({
  groups: z.array(mergeGroupSchema).min(1).max(200),
})

export type MergeGroupInput = z.infer<typeof mergeGroupSchema>
export type MergeGroupsInput = z.infer<typeof mergeGroupsSchema>
