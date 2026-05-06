import { runMigrationsWithLock } from './lib/db/run-migrations'
import { runEmailCheckerStartupSelfCheck } from './lib/email-checker/startup-self-check'
import { spawn } from 'node:child_process'

async function main() {
  await runMigrationsWithLock()
  await runEmailCheckerStartupSelfCheck('web')
  const child = spawn('node', ['server.js'], { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 0))
  child.on('error', (err) => {
    console.error('Failed to start server.js', err)
    process.exit(1)
  })
}

main().catch((err) => {
  console.error('Web bootstrap failed', err)
  process.exit(1)
})
