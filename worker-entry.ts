import { runMigrationsWithLock } from './lib/db/run-migrations'
import { runEmailCheckerStartupSelfCheck } from './lib/email-checker/startup-self-check'

async function main() {
  await runMigrationsWithLock()
  await runEmailCheckerStartupSelfCheck('worker')
  await import('./worker')
}

main().catch((err) => {
  console.error('Worker bootstrap failed', err)
  process.exit(1)
})
