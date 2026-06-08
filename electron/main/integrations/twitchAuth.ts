import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'
import { waitForOAuthCallback } from './oauthServer'
import { saveConnection } from './authStore'
import type { PlatformConnection } from '../../../src/types'

const REDIRECT_PORT = 3456
const REDIRECT_PATH = '/auth/twitch/callback'
const SCOPES = [
  'user:read:email',
  'chat:read',
  'channel:read:subscriptions',
  'moderator:read:followers'
].join(' ')

function getCredentials() {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Configurez TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET dans un fichier .env')
  }
  return { clientId, clientSecret }
}

function generatePkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export async function connectTwitch(): Promise<PlatformConnection> {
  const { clientId, clientSecret } = getCredentials()
  const { verifier, challenge } = generatePkce()
  const redirectUri = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`

  const authUrl = new URL('https://id.twitch.tv/oauth2/authorize')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  const paramsPromise = waitForOAuthCallback(REDIRECT_PORT, REDIRECT_PATH)
  await shell.openExternal(authUrl.toString())

  const params = await paramsPromise
  const code = params.get('code')
  if (!code) throw new Error(params.get('error_description') ?? 'Autorisation refusée')

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  })

  if (!tokenRes.ok) throw new Error('Échec de l\'échange du token Twitch')
  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Client-Id': clientId
    }
  })

  if (!userRes.ok) throw new Error('Impossible de récupérer le profil Twitch')
  const userData = await userRes.json() as { data: Array<{
    id: string
    login: string
    display_name: string
    profile_image_url: string
  }> }

  const user = userData.data[0]
  const connection: PlatformConnection = {
    platform: 'twitch',
    userId: user.id,
    username: user.login,
    displayName: user.display_name,
    avatarUrl: user.profile_image_url,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    connectedAt: Date.now()
  }

  saveConnection('twitch', connection)
  return connection
}

export function isTwitchConfigured(): boolean {
  return !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET)
}
