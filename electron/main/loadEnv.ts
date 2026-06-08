import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export function loadEnv(): void {
  const paths = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env')
  ]

  for (const path of paths) {
    if (!existsSync(path)) continue
    const lines = readFileSync(path, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
    break
  }
}
