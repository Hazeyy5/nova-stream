/**
 * PayPal OAuth + Checkout (compte Standard ou Business du streamer).
 * Les commandes sont créées avec le token du streamer → l'argent va sur son compte.
 */

const OAUTH_SCOPES = 'openid profile email https://uri.paypal.com/services/paypalattributes'

export function paypalConfigured(env) {
  return !!(env.PAYPAL_CLIENT_ID?.trim() && env.PAYPAL_CLIENT_SECRET?.trim())
}

export function paypalApiBase(env) {
  return env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

export function paypalWebBase(env) {
  return env.PAYPAL_MODE === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com'
}

function basicAuth(env) {
  const id = env.PAYPAL_CLIENT_ID.trim()
  const secret = env.PAYPAL_CLIENT_SECRET.trim()
  return `Basic ${btoa(`${id}:${secret}`)}`
}

function encodeState(payload) {
  const json = JSON.stringify(payload)
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeState(raw) {
  if (!raw) return null
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return JSON.parse(atob(padded + pad))
  } catch {
    return null
  }
}

async function paypalFetch(env, path, options = {}) {
  const url = `${paypalApiBase(env)}${path}`
  const res = await fetch(url, options)
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const msg = data.message || data.error_description || data.name || `PayPal HTTP ${res.status}`
    throw new Error(String(msg))
  }
  return data
}

export async function getPlatformAccessToken(env) {
  const data = await paypalFetch(env, '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuth(env),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  return data.access_token
}

export async function exchangeAuthCode(env, code) {
  const redirectUri = `${env.PAYPAL_REDIRECT_URI || ''}`.trim()
  if (!redirectUri) throw new Error('PAYPAL_REDIRECT_URI non configuré')

  const data = await paypalFetch(env, '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuth(env),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    }).toString()
  })
  return data
}

export async function refreshSellerAccessToken(env, refreshToken) {
  if (!refreshToken) throw new Error('Refresh token PayPal manquant')

  const data = await paypalFetch(env, '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuth(env),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  })
  return data
}

export async function fetchPayPalUserInfo(env, accessToken) {
  return paypalFetch(env, '/v1/identity/oauth2/userinfo?schema=paypalv1.1', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

export function buildConnectUrl(env, { streamerId, donationKey, accountType, returnUrl }) {
  const redirectUri = `${env.PAYPAL_REDIRECT_URI || ''}`.trim()
  if (!redirectUri) throw new Error('PAYPAL_REDIRECT_URI non configuré')

  const state = encodeState({
    streamerId,
    donationKey,
    accountType: accountType === 'business' ? 'business' : 'standard',
    returnUrl: returnUrl || ''
  })

  const params = new URLSearchParams({
    client_id: env.PAYPAL_CLIENT_ID.trim(),
    response_type: 'code',
    scope: OAUTH_SCOPES,
    redirect_uri: redirectUri,
    state
  })

  return `${paypalWebBase(env)}/signin/authorize?${params.toString()}`
}

export async function getPayPalAccount(db, streamerId) {
  return db
    .prepare('SELECT * FROM paypal_accounts WHERE streamer_id = ?')
    .bind(streamerId)
    .first()
}

export async function savePayPalAccount(db, streamerId, payload) {
  const now = Date.now()
  await db
    .prepare(`
      INSERT INTO paypal_accounts (
        streamer_id, account_type, merchant_id, email, payer_id,
        access_token_enc, refresh_token_enc, token_expires_at, connected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(streamer_id) DO UPDATE SET
        account_type = excluded.account_type,
        merchant_id = excluded.merchant_id,
        email = excluded.email,
        payer_id = excluded.payer_id,
        access_token_enc = excluded.access_token_enc,
        refresh_token_enc = excluded.refresh_token_enc,
        token_expires_at = excluded.token_expires_at,
        connected_at = excluded.connected_at
    `)
    .bind(
      streamerId,
      payload.accountType,
      payload.merchantId ?? '',
      payload.email ?? '',
      payload.payerId ?? '',
      payload.accessToken ?? '',
      payload.refreshToken ?? '',
      payload.tokenExpiresAt ?? null,
      now
    )
    .run()
}

export async function deletePayPalAccount(db, streamerId) {
  await db.prepare('DELETE FROM paypal_accounts WHERE streamer_id = ?').bind(streamerId).run()
}

export function rowToPayPalPublic(row) {
  if (!row) return { connected: false }
  return {
    connected: true,
    accountType: row.account_type || 'standard',
    email: row.email || '',
    payerId: row.payer_id || '',
    connectedAt: row.connected_at || null
  }
}

export async function getSellerAccessToken(env, db, streamerId) {
  const row = await getPayPalAccount(db, streamerId)
  if (!row?.refresh_token_enc && !row?.access_token_enc) return null

  const expiresAt = row.token_expires_at ?? 0
  if (row.access_token_enc && expiresAt > Date.now() + 60_000) {
    return row.access_token_enc
  }

  if (!row.refresh_token_enc) return row.access_token_enc || null

  const refreshed = await refreshSellerAccessToken(env, row.refresh_token_enc)
  const accessToken = refreshed.access_token
  const tokenExpiresAt = Date.now() + (Number(refreshed.expires_in) || 3600) * 1000

  await db
    .prepare(`
      UPDATE paypal_accounts SET
        access_token_enc = ?,
        refresh_token_enc = COALESCE(?, refresh_token_enc),
        token_expires_at = ?
      WHERE streamer_id = ?
    `)
    .bind(
      accessToken,
      refreshed.refresh_token || null,
      tokenExpiresAt,
      streamerId
    )
    .run()

  return accessToken
}

export async function createCheckoutOrder(env, db, { streamer, donation, returnUrl, cancelUrl }) {
  const sellerToken = await getSellerAccessToken(env, db, streamer.streamerId)
  if (!sellerToken) {
    throw new Error('Compte PayPal streamer indisponible — reconnectez PayPal')
  }

  const amountValue = Number(donation.amount).toFixed(2)
  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: donation.id,
        custom_id: donation.id,
        description: `Don pour ${streamer.displayName}`,
        amount: {
          currency_code: donation.currency,
          value: amountValue
        }
      }
    ],
    application_context: {
      brand_name: 'Nova Stream',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  }

  return paypalFetch(env, '/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(body)
  })
}

export async function captureCheckoutOrder(env, db, streamerId, orderId) {
  const sellerToken = await getSellerAccessToken(env, db, streamerId)
  if (!sellerToken) throw new Error('Compte PayPal streamer indisponible')

  return paypalFetch(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sellerToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  })
}

export async function markDonationPaid(db, donationId, paymentRef) {
  const now = Date.now()
  await db
    .prepare(`
      UPDATE donations SET
        status = 'pending_alert',
        payment_provider = 'paypal',
        payment_ref = ?,
        paid_at = ?
      WHERE id = ? AND status = 'pending_payment'
    `)
    .bind(paymentRef, now, donationId)
    .run()
}

export async function handleOAuthCallback(env, db, { code, stateRaw }) {
  const state = decodeState(stateRaw)
  if (!state?.streamerId || !state?.donationKey) {
    throw new Error('État OAuth invalide')
  }

  const streamer = await db
    .prepare('SELECT * FROM streamers WHERE streamer_id = ?')
    .bind(state.streamerId)
    .first()

  if (!streamer || streamer.donation_key !== state.donationKey) {
    throw new Error('Streamer non autorisé')
  }

  const tokens = await exchangeAuthCode(env, code)
  const userInfo = await fetchPayPalUserInfo(env, tokens.access_token)

  const paypalAccountType = String(userInfo.account_type || userInfo.accountType || '').toUpperCase()
  const chosenType = state.accountType === 'business' ? 'business' : 'standard'

  await savePayPalAccount(db, state.streamerId, {
    accountType: chosenType,
    merchantId: userInfo.payer_id || userInfo.user_id || '',
    payerId: userInfo.payer_id || userInfo.user_id || '',
    email: userInfo.email || '',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || '',
    tokenExpiresAt: Date.now() + (Number(tokens.expires_in) || 3600) * 1000
  })

  return {
    returnUrl: state.returnUrl || '',
    email: userInfo.email || '',
    accountType: chosenType,
    paypalAccountType
  }
}

export async function verifyAndParseWebhook(env, request) {
  const webhookId = env.PAYPAL_WEBHOOK_ID?.trim()
  if (!webhookId) return null

  const body = await request.text()
  let event
  try {
    event = JSON.parse(body)
  } catch {
    return null
  }

  const platformToken = await getPlatformAccessToken(env)
  const verify = await paypalFetch(env, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${platformToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auth_algo: request.headers.get('PAYPAL-AUTH-ALGO'),
      cert_url: request.headers.get('PAYPAL-CERT-URL'),
      transmission_id: request.headers.get('PAYPAL-TRANSMISSION-ID'),
      transmission_sig: request.headers.get('PAYPAL-TRANSMISSION-SIG'),
      transmission_time: request.headers.get('PAYPAL-TRANSMISSION-TIME'),
      webhook_id: webhookId,
      webhook_event: event
    })
  })

  if (verify.verification_status !== 'SUCCESS') return null
  return event
}

export async function processWebhookEvent(db, event) {
  const type = event?.event_type
  if (type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return { handled: false }
  }

  const donationId = event.resource?.custom_id || event.resource?.invoice_id || ''
  const paymentRef = event.resource?.id || ''

  if (!donationId) return { handled: false }

  await markDonationPaid(db, donationId, paymentRef)
  return { handled: true, donationId }
}
