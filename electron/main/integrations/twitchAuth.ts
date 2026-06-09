import { randomBytes, createHash } from 'crypto'
import { shell } from 'electron'
import { waitForOAuthCallback } from './oauthServer'
import { saveConnection } from './authStore'
import { getPublicTwitchClientId } from '../platformConfig'
import type { PlatformConnection } from '../../../src/types'

const REDIRECT_PORT = 3456
const REDIRECT_PATH = '/auth/twitch/callback'
const SCOPES = [
  'user:read:email',
  'chat:read',
  'channel:read:subscriptions',
  'moderator:read:followers'
].join(' ')

function generatePkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function requireClientId(): string {
  const clientId = getPublicTwitchClientId()
  if (!clientId) {
    throw new Error(
      'Twitch non configuré pour Nova Stream. Le mainteneur doit renseigner twitchClientId dans shared/platform.json'
    )
  }
  return clientId
}

async function fetchTwitchProfile(clientId: string, accessToken: string) {
  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  return userData.data[0]
}

function buildConnection(
  user: { id: string; login: string; display_name: string; profile_image_url: string },
  tokens: { access_token: string; refresh_token?: string; expires_in?: number }
): PlatformConnection {
  return {
    platform: 'twitch',
    userId: user.id,
    username: user.login,
    displayName: user.display_name,
    avatarUrl: user.profile_image_url,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
    connectedAt: Date.now()
  }
}

/** Flux public PKCE — utilisé par tous les utilisateurs finaux (sans .env). */
async function connectWithPkce(clientId: string): Promise<PlatformConnection> {
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

  const body: Record<string, string> = {
    client_id: clientId,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: verifier
  }

  const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim()
  if (clientSecret) body.client_secret = clientSecret

  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body)
  })

  if (!tokenRes.ok) throw new Error('Échec de l\'échange du token Twitch')
  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  const user = await fetchTwitchProfile(clientId, tokens.access_token)
  const connection = buildConnection(user, tokens)
  saveConnection('twitch', connection)
  return connection
}

export async function connectTwitch(): Promise<PlatformConnection> {
  const clientId = requireClientId()
  return connectWithPkce(clientId)
}

export function isTwitchConfigured(): boolean {
  return !!getPublicTwitchClientId()
}
