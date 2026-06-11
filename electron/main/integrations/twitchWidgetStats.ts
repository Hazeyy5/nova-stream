import { getToken } from './authStore'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'

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
  const token = getToken('twitch')
  if (!token?.userId) return EMPTY

  const accessToken = await ensureFreshTwitchToken()
  if (!accessToken) return EMPTY

  const clientId = process.env.TWITCH_CLIENT_ID ?? ''
  if (!clientId) return EMPTY

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Client-Id': clientId
  }

  try {
    const [streamRes, followersRes] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/streams?user_id=${token.userId}`, { headers }),
      fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${token.userId}&first=1`, { headers })
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

    return { viewerCount, followerCount, subCount: 0, live }
  } catch {
    return EMPTY
  }
}
