const STORAGE_KEY = 'nova_web_session'
const STATE_KEY = 'nova_oauth_state'

function basePath() {
  return window.NOVA_CONFIG?.BASE_PATH?.replace(/\/$/, '') || ''
}

function asset(path) {
  return `${basePath()}${path}`
}

function generateState() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

function getSession() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        localStorage.setItem(STORAGE_KEY, raw)
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data.expiresAt && Date.now() > data.expiresAt) {
      clearSession()
      return null
    }
    return data
  } catch { return null }
}

function setSession(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  sessionStorage.removeItem(STORAGE_KEY)
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STATE_KEY)
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

  const state = generateState()
  sessionStorage.setItem(STATE_KEY, state)

  const redirectUri = `${location.origin}${asset('/oauth/callback.html')}`
  const url = new URL('https://id.twitch.tv/oauth2/authorize')
  url.searchParams.set('client_id', window.NOVA_CONFIG.TWITCH_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'token')
  url.searchParams.set('scope', window.NOVA_CONFIG.SCOPES)
  url.searchParams.set('state', state)

  location.href = url.toString()
}

async function handleOAuthCallback() {
  const queryParams = new URLSearchParams(location.search)
  const queryError = queryParams.get('error_description') || queryParams.get('error')
  if (queryError) throw new Error(queryError)

  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
  const params = new URLSearchParams(hash)

  const expectedState = sessionStorage.getItem(STATE_KEY)
  const state = params.get('state')
  if (!expectedState || state !== expectedState) {
    throw new Error('État OAuth invalide — recommencez la connexion')
  }
  sessionStorage.removeItem(STATE_KEY)

  const accessToken = params.get('access_token')
  if (!accessToken) throw new Error('Token OAuth manquant')

  const userRes = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': window.NOVA_CONFIG.TWITCH_CLIENT_ID
    }
  })

  if (!userRes.ok) throw new Error('Impossible de récupérer le profil')
  const userData = await userRes.json()
  const user = userData.data[0]

  const expiresIn = Number.parseInt(params.get('expires_in') || '0', 10)
  const defaultTtl = 4 * 3600 * 1000

  setSession({
    platform: 'twitch',
    accessToken,
    userId: user.id,
    username: user.login,
    displayName: user.display_name,
    avatarUrl: user.profile_image_url,
    connectedAt: Date.now(),
    expiresAt: Date.now() + (expiresIn > 0 ? expiresIn * 1000 : defaultTtl)
  })

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
