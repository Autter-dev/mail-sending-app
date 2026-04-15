import { PgBoss } from 'pg-boss'

let boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      max: 10,
    })
    await boss.start()
  }
  return boss
}

export const JOBS = {
  SEND_CAMPAIGN: 'send-campaign',
  SEND_EMAIL: 'send-email',
  FINALIZE_CAMPAIGN: 'finalize-campaign',
} as const
