import { getPublicTwitchClientId } from '../platformConfig'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import type { FeedEvent } from '../../../src/types'

async function helixHeaders(): Promise<{ Authorization: string; 'Client-Id': string } | null> {
  const twitch = await ensureFreshTwitchToken()
  const clientId = getPublicTwitchClientId()
  if (!twitch || !clientId) return null
  return {
    Authorization: `Bearer ${twitch.accessToken}`,
    'Client-Id': clientId
  }
}

/** Récupère les derniers follows/subs via Helix (sans EventSub). */
export async function fetchRecentTwitchActivity(limit = 15): Promise<FeedEvent[]> {
  const headers = await helixHeaders()
  const twitch = await ensureFreshTwitchToken()
  if (!headers || !twitch) return []

  const broadcasterId = twitch.userId
  const events: FeedEvent[] = []

  try {
    const followersUrl = new URL('https://api.twitch.tv/helix/channels/followers')
    followersUrl.searchParams.set('broadcaster_id', broadcasterId)
    followersUrl.searchParams.set('first', String(Math.min(100, limit)))

    const followersRes = await fetch(followersUrl.toString(), { headers })
    if (followersRes.ok) {
      const json = (await followersRes.json()) as {
        data?: Array<{ user_id: string; user_name?: string; user_login?: string; followed_at: string }>
      }
      for (const row of json.data ?? []) {
        const name = row.user_name ?? row.user_login ?? 'Viewer'
        events.push({
          id: `follow-${row.user_id}-${row.followed_at}`,
          type: 'follow',
          platform: 'twitch',
          icon: '💜',
          text: `${name} a suivi la chaîne`,
          timestamp: new Date(row.followed_at).getTime() || Date.now()
        })
      }
    }
  } catch {
    /* scope manquant ou réseau */
  }

  try {
    const subsUrl = new URL('https://api.twitch.tv/helix/subscriptions')
    subsUrl.searchParams.set('broadcaster_id', broadcasterId)
    subsUrl.searchParams.set('first', String(Math.min(100, limit)))

    const subsRes = await fetch(subsUrl.toString(), { headers })
    if (subsRes.ok) {
      const json = (await subsRes.json()) as {
        data?: Array<{ user_id: string; user_name?: string; user_login?: string; tier?: string; gifter_name?: string }>
      }
      for (const row of json.data ?? []) {
        const name = row.user_name ?? row.user_login ?? 'Viewer'
        events.push({
          id: `sub-${row.user_id}-${row.tier ?? '1000'}`,
          type: 'sub',
          platform: 'twitch',
          icon: '⭐',
          text: `${name} s'est abonné`,
          timestamp: Date.now()
        })
      }
    }
  } catch {
    /* ignore */
  }

  return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
}
