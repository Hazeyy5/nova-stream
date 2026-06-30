/** Vérifie un token OAuth Twitch et retourne l'utilisateur Helix. */

export async function verifyTwitchToken(env, accessToken) {
  const clientId = env.TWITCH_CLIENT_ID?.trim()
  const token = String(accessToken ?? '').trim()
  if (!clientId || !token) return null

  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId
    },
    signal: AbortSignal.timeout(8000)
  })

  if (!res.ok) return null
  const data = await res.json()
  const user = data.data?.[0]
  if (!user?.id) return null

  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name
  }
}

export async function requireStreamerAuth(request, env, streamerId) {
  const expected = String(streamerId ?? '').trim()
  if (!expected) return null

  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const user = await verifyTwitchToken(env, token)
  if (!user || user.id !== expected) return null
  return user
}
