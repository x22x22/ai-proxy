import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default async function globalSetup() {
  execSync('npm run build', {
    cwd: path.resolve(__dirname, '..', '..'),
    stdio: 'inherit',
  })
}
