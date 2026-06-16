import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
export interface PlatformConfig {
  appName: string
  version: string
  websiteUrl: string
  githubUrl: string
  twitchClientId: string
  donationsApiUrl?: string
  supportEmail: string
}

let cached: PlatformConfig | null = null

function getConfigPath(): string {
  const devPath = join(__dirname, '../../shared/platform.json')
  if (existsSync(devPath)) return devPath
  return join(process.resourcesPath, 'shared/platform.json')
}

export function getPlatformConfig(): PlatformConfig {
  if (cached) return cached
  cached = JSON.parse(readFileSync(getConfigPath(), 'utf-8')) as PlatformConfig
  return cached
}

export function getPublicTwitchClientId(): string | null {
  const fromEnv = process.env.TWITCH_CLIENT_ID?.trim()
  if (fromEnv) return fromEnv
  const fromConfig = getPlatformConfig().twitchClientId?.trim()
  return fromConfig || null
}

export function isTwitchAvailable(): boolean {
  return !!getPublicTwitchClientId()
}

export function getDonationsApiUrl(): string | null {
  const fromEnv = process.env.DONATIONS_API_URL?.trim()
  if (fromEnv) return fromEnv
  const fromConfig = getPlatformConfig().donationsApiUrl?.trim()
  return fromConfig || null
}
