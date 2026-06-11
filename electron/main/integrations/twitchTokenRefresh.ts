import { getToken, saveConnection } from './authStore'
import { getPublicTwitchClientId } from '../platformConfig'
import type { PlatformConnection } from '../../../src/types'

export async function ensureFreshTwitchToken(): Promise<PlatformConnection | null> {
  const conn = getToken('twitch')
  if (!conn) return null

  const expiresSoon = conn.expiresAt != null && conn.expiresAt < Date.now() + 120_000
  if (!expiresSoon || !conn.refreshToken) return conn

  const clientId = getPublicTwitchClientId()
  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return conn

  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    if (!res.ok) return conn

    const tokens = (await res.json()) as {
      access_token: string
      refresh_token?: string
      expires_in?: number
    }

    const updated: PlatformConnection = {
      ...conn,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? conn.refreshToken,
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : conn.expiresAt
    }
    saveConnection('twitch', updated)
    return updated
  } catch {
    return conn
  }
}
