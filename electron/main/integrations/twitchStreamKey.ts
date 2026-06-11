import { getToken } from './authStore'
import { getPublicTwitchClientId } from '../platformConfig'

export async function fetchTwitchStreamKey(): Promise<string> {
  const conn = getToken('twitch')
  if (!conn) {
    throw new Error('Compte Twitch non connecté — liez votre compte dans Apps.')
  }

  const clientId = getPublicTwitchClientId()
  if (!clientId) {
    throw new Error('Client ID Twitch non configuré.')
  }

  const res = await fetch(
    `https://api.twitch.tv/helix/streams/key?broadcaster_id=${encodeURIComponent(conn.userId)}`,
    {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        'Client-Id': clientId
      }
    }
  )

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Session Twitch expirée — reconnectez votre compte.')
    }
    throw new Error(`Impossible de récupérer la clé de stream (${res.status}).`)
  }

  const data = (await res.json()) as { data?: { stream_key?: string }[] }
  const key = data.data?.[0]?.stream_key
  if (!key) {
    throw new Error('Clé de stream introuvable pour ce compte.')
  }

  return key
}
