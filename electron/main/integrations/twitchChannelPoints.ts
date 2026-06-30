import { getToken } from './authStore'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import { getPublicTwitchClientId } from '../platformConfig'

const HELIX = 'https://api.twitch.tv/helix/channel_points/custom_rewards'

export interface TwitchCustomReward {
  id: string
  title: string
  cost: number
  prompt: string
  is_enabled: boolean
  is_user_input_required: boolean
  background_color: string
}

async function requireTwitchAuth(): Promise<{
  accessToken: string
  clientId: string
  broadcasterId: string
}> {
  const stored = getToken('twitch')
  if (!stored) throw new Error('Compte Twitch non connecté')
  const conn = await ensureFreshTwitchToken()
  if (!conn) throw new Error('Session Twitch expirée — reconnectez votre compte.')
  const clientId = getPublicTwitchClientId()
  if (!clientId) throw new Error('Client ID Twitch non configuré')
  return { accessToken: conn.accessToken, clientId, broadcasterId: conn.userId }
}

export async function listCustomRewards(): Promise<TwitchCustomReward[]> {
  const { accessToken, clientId, broadcasterId } = await requireTwitchAuth()
  const res = await fetch(`${HELIX}?broadcaster_id=${encodeURIComponent(broadcasterId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': clientId }
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Impossible de lister les récompenses (${res.status})${err ? `: ${err.slice(0, 120)}` : ''}`)
  }
  const data = await res.json() as { data?: TwitchCustomReward[] }
  return data.data ?? []
}

export async function createTtsReward(input: {
  title: string
  cost: number
  prompt?: string
}): Promise<TwitchCustomReward> {
  const { accessToken, clientId, broadcasterId } = await requireTwitchAuth()
  const cost = Math.max(1, Math.min(999999, Math.round(input.cost)))
  const title = input.title.trim().slice(0, 45) || 'Lire mon message'
  const prompt = (input.prompt?.trim() || 'Votre message TTS').slice(0, 200)

  const res = await fetch(`${HELIX}?broadcaster_id=${encodeURIComponent(broadcasterId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      cost,
      prompt,
      is_user_input_required: true,
      is_enabled: true,
      background_color: '#9146FF'
    })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Création récompense échouée (${res.status})${err ? `: ${err.slice(0, 160)}` : ''}`)
  }
  const data = await res.json() as { data?: TwitchCustomReward[] }
  const reward = data.data?.[0]
  if (!reward) throw new Error('Réponse Twitch invalide')
  return reward
}

export async function updateCustomReward(
  rewardId: string,
  partial: { title?: string; cost?: number; prompt?: string; is_enabled?: boolean }
): Promise<TwitchCustomReward> {
  const { accessToken, clientId, broadcasterId } = await requireTwitchAuth()
  const body: Record<string, unknown> = {}
  if (partial.title !== undefined) body.title = partial.title.trim().slice(0, 45)
  if (partial.cost !== undefined) body.cost = Math.max(1, Math.min(999999, Math.round(partial.cost)))
  if (partial.prompt !== undefined) body.prompt = partial.prompt.trim().slice(0, 200)
  if (partial.is_enabled !== undefined) body.is_enabled = partial.is_enabled

  const res = await fetch(
    `${HELIX}?broadcaster_id=${encodeURIComponent(broadcasterId)}&id=${encodeURIComponent(rewardId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mise à jour récompense échouée (${res.status})${err ? `: ${err.slice(0, 160)}` : ''}`)
  }
  const data = await res.json() as { data?: TwitchCustomReward[] }
  const reward = data.data?.[0]
  if (!reward) throw new Error('Réponse Twitch invalide')
  return reward
}
