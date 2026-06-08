import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { PlatformConnection, PlatformConnectionPublic } from '../../../src/types'

const FILE = () => join(app.getPath('userData'), 'connections.json')

interface Store {
  twitch?: PlatformConnection
  kick?: PlatformConnection
}

export function loadConnections(): Store {
  try {
    const path = FILE()
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf-8')) as Store
  } catch {
    return {}
  }
}

export function saveConnection(platform: 'twitch' | 'kick', conn: PlatformConnection): void {
  const store = loadConnections()
  store[platform] = conn
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  writeFileSync(FILE(), JSON.stringify(store, null, 2))
}

export function removeConnection(platform: 'twitch' | 'kick'): void {
  const store = loadConnections()
  delete store[platform]
  writeFileSync(FILE(), JSON.stringify(store, null, 2))
}

export function getPublicConnections(): PlatformConnectionPublic[] {
  const store = loadConnections()
  const result: PlatformConnectionPublic[] = []
  for (const platform of ['twitch', 'kick'] as const) {
    const c = store[platform]
    if (c) {
      result.push({
        platform,
        userId: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        connectedAt: c.connectedAt
      })
    }
  }
  return result
}

export function getToken(platform: 'twitch' | 'kick'): PlatformConnection | null {
  return loadConnections()[platform] ?? null
}
