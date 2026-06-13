import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import { getPublicTwitchClientId } from '../platformConfig'

export interface TwitchWidgetStats {
  viewerCount: number
  followerCount: number
  subCount: number
  live: boolean
}

const EMPTY: TwitchWidgetStats = {
  viewerCount: 0,
  followerCount: 0,
  subCount: 0,
  live: false
}

export async function fetchTwitchWidgetStats(): Promise<TwitchWidgetStats> {
  const conn = await ensureFreshTwitchToken()
  if (!conn?.userId) return EMPTY

  const clientId = getPublicTwitchClientId()
  if (!clientId) return EMPTY

  const headers = {
    Authorization: `Bearer ${conn.accessToken}`,
    'Client-Id': clientId
  }

  const broadcasterId = encodeURIComponent(conn.userId)

  try {
    const [streamRes, followersRes, subsRes] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/streams?user_id=${broadcasterId}`, { headers }),
      fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`, { headers }),
      fetch(`https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`, { headers })
    ])

    let viewerCount = 0
    let live = false
    if (streamRes.ok) {
      const streamJson = (await streamRes.json()) as { data?: { viewer_count?: number }[] }
      const stream = streamJson.data?.[0]
      if (stream) {
        viewerCount = stream.viewer_count ?? 0
        live = true
      }
    }

    let followerCount = 0
    if (followersRes.ok) {
      const followersJson = (await followersRes.json()) as { total?: number }
      followerCount = followersJson.total ?? 0
    }

    let subCount = 0
    if (subsRes.ok) {
      const subsJson = (await subsRes.json()) as { total?: number }
      subCount = subsJson.total ?? 0
    }

    return { viewerCount, followerCount, subCount, live }
  } catch {
    return EMPTY
  }
}
