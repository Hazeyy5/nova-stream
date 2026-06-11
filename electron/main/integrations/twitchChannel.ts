import { getToken } from './authStore'
import { ensureFreshTwitchToken } from './twitchTokenRefresh'
import { getPublicTwitchClientId } from '../platformConfig'

export interface TwitchChannelInfo {
  title: string
  categoryId: string
  categoryName: string
}

export interface TwitchCategoryResult {
  id: string
  name: string
  boxArtUrl?: string
}

async function requireTwitchAuth(): Promise<{
  accessToken: string
  clientId: string
  broadcasterId: string
}> {
  const conn = getToken('twitch')
  if (!conn) {
    throw new Error('Compte Twitch non connecté — liez votre compte dans Apps.')
  }

  const accessToken = await ensureFreshTwitchToken()
  if (!accessToken) {
    throw new Error('Session Twitch expirée — reconnectez votre compte.')
  }

  const clientId = getPublicTwitchClientId()
  if (!clientId) {
    throw new Error('Client ID Twitch non configuré.')
  }

  return { accessToken, clientId, broadcasterId: conn.userId }
}

export async function getTwitchChannelInfo(): Promise<TwitchChannelInfo> {
  const { accessToken, clientId, broadcasterId } = await requireTwitchAuth()

  const res = await fetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId
      }
    }
  )

  if (!res.ok) {
    throw new Error(`Impossible de lire les infos de la chaîne (${res.status}).`)
  }

  const data = (await res.json()) as {
    data?: Array<{ title?: string; game_id?: string; game_name?: string }>
  }
  const channel = data.data?.[0]

  return {
    title: channel?.title?.trim() ?? '',
    categoryId: channel?.game_id ?? '',
    categoryName: channel?.game_name?.trim() ?? ''
  }
}

export async function searchTwitchCategories(query: string): Promise<TwitchCategoryResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const { accessToken, clientId } = await requireTwitchAuth()

  const url = new URL('https://api.twitch.tv/helix/search/categories')
  url.searchParams.set('query', trimmed)
  url.searchParams.set('first', '20')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId
    }
  })

  if (!res.ok) {
    throw new Error(`Recherche de catégorie échouée (${res.status}).`)
  }

  const data = (await res.json()) as {
    data?: Array<{ id: string; name: string; box_art_url?: string }>
  }

  return (data.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    boxArtUrl: item.box_art_url
  }))
}

export async function updateTwitchChannelInfo(title: string, categoryId: string): Promise<void> {
  const trimmedTitle = title.trim()
  if (!trimmedTitle) {
    throw new Error('Le titre du live est obligatoire.')
  }
  if (trimmedTitle.length > 140) {
    throw new Error('Le titre ne peut pas dépasser 140 caractères.')
  }
  if (!categoryId.trim()) {
    throw new Error('Choisissez une catégorie Twitch.')
  }

  const { accessToken, clientId, broadcasterId } = await requireTwitchAuth()

  const res = await fetch(
    `https://api.twitch.tv/helix/channels?broadcaster_id=${encodeURIComponent(broadcasterId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: trimmedTitle,
        game_id: categoryId
      })
    }
  )

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Permission refusée — reconnectez Twitch sur le site (scope channel:manage:broadcast requis).'
      )
    }
    throw new Error(`Impossible de mettre à jour la chaîne (${res.status}).`)
  }
}
