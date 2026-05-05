import { createHmac } from 'crypto'
import { nanoid } from 'nanoid'

export function generateInviteToken(): string {
  return nanoid(32)
}

export function hashInviteToken(token: string): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY not set')
  return createHmac('sha256', key).update(token).digest('hex')
}
