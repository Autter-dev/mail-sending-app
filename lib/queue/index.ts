import { PgBoss } from 'pg-boss'

let boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      max: 10,
    })
    await boss.start()
    // Create queues if they don't exist (required in pg-boss v12+)
    for (const queue of [JOBS.SEND_EMAIL, JOBS.FINALIZE_CAMPAIGN, JOBS.SEND_CONFIRMATION]) {
      try {
        await boss.createQueue(queue)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : ''
        if (!msg.includes('already exists')) throw e
      }
    }
  }
  return boss
}

export const JOBS = {
  SEND_CAMPAIGN: 'send-campaign',
  SEND_EMAIL: 'send-email',
  FINALIZE_CAMPAIGN: 'finalize-campaign',
  SEND_CONFIRMATION: 'send-confirmation',
} as const
