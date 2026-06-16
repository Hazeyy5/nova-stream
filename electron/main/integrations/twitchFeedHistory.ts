import { getPublicTwitchClientId } from '../platformConfig'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import type { FeedEvent } from '../../../src/types'

export interface TwitchFollowRow {
  userId: string
  username: string
  followedAt: number
  feedId: string
}

async function helixHeaders(): Promise<{ Authorization: string; 'Client-Id': string } | null> {
  const twitch = await ensureFreshTwitchToken()
  const clientId = getPublicTwitchClientId()
  if (!twitch || !clientId) return null
  return {
    Authorization: `Bearer ${twitch.accessToken}`,
    'Client-Id': clientId
  }
}

function toFollowRow(row: {
  user_id: string
  user_name?: string
  user_login?: string
  followed_at: string
}): TwitchFollowRow {
  const username = row.user_name ?? row.user_login ?? 'Viewer'
  const followedAt = new Date(row.followed_at).getTime() || Date.now()
  return {
    userId: row.user_id,
    username,
    followedAt,
    feedId: `follow-${row.user_id}-${row.followed_at}`
  }
}

/** Derniers follows via Helix (nécessite moderator:read:followers). */
export async function fetchRecentTwitchFollows(limit = 25): Promise<TwitchFollowRow[]> {
  const headers = await helixHeaders()
  const twitch = await ensureFreshTwitchToken()
  if (!headers || !twitch) return []

  try {
    const url = new URL('https://api.twitch.tv/helix/channels/followers')
    url.searchParams.set('broadcaster_id', twitch.userId)
    url.searchParams.set('first', String(Math.min(100, limit)))

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      console.warn('[Helix] followers fetch failed:', res.status)
      return []
    }

    const json = (await res.json()) as {
      data?: Array<{ user_id: string; user_name?: string; user_login?: string; followed_at: string }>
    }
    return (json.data ?? []).map(toFollowRow).sort((a, b) => b.followedAt - a.followedAt)
  } catch (err) {
    console.warn('[Helix] followers fetch error:', err)
    return []
  }
}

/** Récupère les derniers follows/subs via Helix (sans EventSub). */
export async function fetchRecentTwitchActivity(limit = 15): Promise<FeedEvent[]> {
  const headers = await helixHeaders()
  const twitch = await ensureFreshTwitchToken()
  if (!headers || !twitch) return []

  const broadcasterId = twitch.userId
  const events: FeedEvent[] = []

  const follows = await fetchRecentTwitchFollows(limit)
  for (const row of follows) {
    events.push({
      id: row.feedId,
      type: 'follow',
      platform: 'twitch',
      icon: '💜',
      text: `${row.username} a suivi la chaîne`,
      timestamp: row.followedAt
    })
  }

  try {
    const subsUrl = new URL('https://api.twitch.tv/helix/subscriptions')
    subsUrl.searchParams.set('broadcaster_id', broadcasterId)
    subsUrl.searchParams.set('first', String(Math.min(100, limit)))

    const subsRes = await fetch(subsUrl.toString(), { headers })
    if (subsRes.ok) {
      const json = (await subsRes.json()) as {
        data?: Array<{ user_id: string; user_name?: string; user_login?: string; tier?: string }>
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
