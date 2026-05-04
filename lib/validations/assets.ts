import { z } from 'zod'

export const renameAssetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
})

export type RenameAssetInput = z.infer<typeof renameAssetSchema>
