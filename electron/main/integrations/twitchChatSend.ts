import { getPublicTwitchClientId } from '../platformConfig'
import { getToken } from './authStore'

export async function sendTwitchChatViaHelix(message: string): Promise<void> {
  const twitch = getToken('twitch')
  if (!twitch) throw new Error('Compte Twitch non connecté')

  const clientId = getPublicTwitchClientId()
  if (!clientId) throw new Error('Twitch non configuré')

  const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${twitch.accessToken}`,
      'Client-Id': clientId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      broadcaster_id: twitch.userId,
      sender_id: twitch.userId,
      message
    })
  })

  if (!res.ok) {
    const body = await res.text()
    if (res.status === 401 || res.status === 403) {
      throw new Error('Permission chat refusée — déconnectez puis reconnectez Twitch dans Apps.')
    }
    throw new Error(`Envoi Twitch échoué (${res.status}): ${body.slice(0, 120)}`)
  }
}
