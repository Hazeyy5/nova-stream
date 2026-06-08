const STORAGE_KEY = 'nova_web_session'
const PKCE_KEY = 'nova_pkce_verifier'

function basePath() {
  return window.NOVA_CONFIG?.BASE_PATH?.replace(/\/$/, '') || ''
}

function asset(path) {
  return `${basePath()}${path}`
}

function generateVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256base64url(str) {
  const data = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function getSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setSession(data) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(PKCE_KEY)
}

function isConfigured() {
  const id = window.NOVA_CONFIG?.TWITCH_CLIENT_ID
  return id && id !== 'YOUR_TWITCH_CLIENT_ID'
}

async function startTwitchLogin() {
  if (!isConfigured()) {
    alert('Le Client ID Twitch n\'est pas configuré dans docs/js/config.js')
    return
  }

  const verifier = generateVerifier()
  sessionStorage.setItem(PKCE_KEY, verifier)
  const challenge = await sha256base64url(verifier)

  const redirectUri = `${location.origin}${asset('/oauth/callback.html')}`
  const url = new URL('https://id.twitch.tv/oauth2/authorize')
  url.searchParams.set('client_id', window.NOVA_CONFIG.TWITCH_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', window.NOVA_CONFIG.SCOPES)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')

  location.href = url.toString()
}

async function handleOAuthCallback() {
  const params = new URLSearchParams(location.search)
  const code = params.get('code')
  const error = params.get('error_description') || params.get('error')

  if (error) throw new Error(error)
  if (!code) throw new Error('Code OAuth manquant')

  const verifier = sessionStorage.getItem(PKCE_KEY)
  if (!verifier) throw new Error('Session PKCE expirée — recommencez la connexion')

  const redirectUri = `${location.origin}${asset('/oauth/callback.html')}`
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: window.NOVA_CONFIG.TWITCH_CLIENT_ID,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error('Échec token : ' + err)
  }

  const tokens = await tokenRes.json()
  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Client-Id': window.NOVA_CONFIG.TWITCH_CLIENT_ID
    }
  })

  if (!userRes.ok) throw new Error('Impossible de récupérer le profil')
  const userData = await userRes.json()
  const user = userData.data[0]

  setSession({
    platform: 'twitch',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    userId: user.id,
    username: user.login,
    displayName: user.display_name,
    avatarUrl: user.profile_image_url,
    connectedAt: Date.now()
  })

  sessionStorage.removeItem(PKCE_KEY)
  location.href = asset('/dashboard.html')
}

function logout() {
  clearSession()
  location.href = asset('/index.html')
}

window.NovaAuth = {
  basePath, asset, getSession, setSession, clearSession,
  isConfigured, startTwitchLogin, handleOAuthCallback, logout
}
