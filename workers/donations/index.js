/**
 * API relais des dons Nova Stream (Cloudflare Worker + D1).
 * PayPal OAuth (Standard / Business) + checkout vérifié avant alerte.
 */

import {
  buildConnectUrl,
  captureCheckoutOrder,
  createCheckoutOrder,
  deletePayPalAccount,
  getPayPalAccount,
  handleOAuthCallback,
  markDonationPaid,
  paypalConfigured,
  processWebhookEvent,
  rowToPayPalPublic,
  verifyAndParseWebhook
} from './paypal.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

function redirect(url, status = 302) {
  return Response.redirect(url, status)
}

function parseSuggested(raw, fallback = [1, 3, 5, 10, 20]) {
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((n) => n > 0).slice(0, 8)
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parseSuggested(parsed)
    } catch {
      /* legacy csv */
    }
  }
  return fallback
}

function rowToStreamer(row, paypalRow = null) {
  if (!row) return null
  const paypal = rowToPayPalPublic(paypalRow)
  return {
    streamerId: row.streamer_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    donationKey: row.donation_key,
    enabled: row.enabled === 1,
    currency: row.currency,
    minAmount: row.min_amount,
    suggestedAmounts: parseSuggested(row.suggested_amounts),
    pageTitle: row.page_title,
    pageMessage: row.page_message,
    thankYouMessage: row.thank_you_message,
    alertTitle: row.alert_title || 'Don',
    alertDefaultMessage: row.alert_default_message || row.thank_you_message || '',
    alertMessageTemplate: row.alert_message_template || '{amount} — {message}',
    paypalUsername: row.paypal_username,
    paypalConnected: paypal.connected,
    paypalEmail: paypal.email || '',
    paypalAccountType: paypal.accountType || '',
    updatedAt: row.updated_at
  }
}

function rowToDonation(row) {
  return {
    id: row.id,
    streamerId: row.streamer_id,
    donorName: row.donor_name,
    message: row.message,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    paymentProvider: row.payment_provider,
    paymentRef: row.payment_ref || '',
    createdAt: row.created_at,
    paidAt: row.paid_at ?? null
  }
}

async function getStreamerById(db, streamerId) {
  const row = await db
    .prepare('SELECT * FROM streamers WHERE streamer_id = ?')
    .bind(streamerId)
    .first()
  if (!row) return null
  const paypalRow = await getPayPalAccount(db, streamerId)
  return rowToStreamer(row, paypalRow)
}

async function getStreamerByUsername(db, username) {
  const row = await db
    .prepare('SELECT * FROM streamers WHERE username = ? COLLATE NOCASE')
    .bind(String(username).toLowerCase())
    .first()
  if (!row) return null
  const paypalRow = await getPayPalAccount(db, row.streamer_id)
  return rowToStreamer(row, paypalRow)
}

async function verifyStreamerKey(db, streamerId, key) {
  const s = await getStreamerById(db, streamerId)
  if (!s || s.donationKey !== key) return null
  return s
}

async function streamerHasPayPal(db, streamerId) {
  const row = await getPayPalAccount(db, streamerId)
  return !!(row?.refresh_token_enc || row?.access_token_enc)
}

function legacyPaypalMeUrl(settings, amount, currency) {
  const paypal = settings.paypalUsername?.trim()
  if (!paypal) return ''
  return `https://paypal.me/${encodeURIComponent(paypal)}/${amount}${currency}`
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const db = env.DB
    if (!db) {
      return json({ success: false, message: 'Base D1 non configurée' }, 500)
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (path === '/v1/health') {
      try {
        await db.prepare('SELECT 1 AS ok').first()
        return json({
          ok: true,
          service: 'nova-donations',
          storage: 'd1',
          paypal: paypalConfigured(env)
        })
      } catch {
        return json({ ok: false, service: 'nova-donations', storage: 'd1' }, 503)
      }
    }

    if (path === '/v1/paypal/config' && request.method === 'GET') {
      return json({
        success: true,
        configured: paypalConfigured(env),
        clientId: env.PAYPAL_CLIENT_ID?.trim() || '',
        mode: env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox'
      })
    }

    if (path === '/v1/paypal/status' && request.method === 'GET') {
      const streamerId = url.searchParams.get('streamerId')
      const key = url.searchParams.get('key')
      if (!streamerId || !key) {
        return json({ success: false, message: 'Paramètres manquants' }, 400)
      }
      const settings = await verifyStreamerKey(db, streamerId, key)
      if (!settings) return json({ success: false, message: 'Non autorisé' }, 403)

      const row = await getPayPalAccount(db, streamerId)
      return json({ success: true, paypal: rowToPayPalPublic(row) })
    }

    if (path === '/v1/paypal/connect-url' && request.method === 'GET') {
      if (!paypalConfigured(env)) {
        return json({ success: false, message: 'PayPal non configuré sur le serveur' }, 503)
      }

      const streamerId = url.searchParams.get('streamerId')
      const key = url.searchParams.get('key')
      const accountType = url.searchParams.get('accountType') === 'business' ? 'business' : 'standard'
      const returnUrl = url.searchParams.get('returnUrl') || ''

      if (!streamerId || !key) {
        return json({ success: false, message: 'Paramètres manquants' }, 400)
      }
      const settings = await verifyStreamerKey(db, streamerId, key)
      if (!settings) return json({ success: false, message: 'Non autorisé' }, 403)

      try {
        const connectUrl = buildConnectUrl(env, { streamerId, donationKey: key, accountType, returnUrl })
        return json({ success: true, url: connectUrl, accountType })
      } catch (err) {
        return json({ success: false, message: err instanceof Error ? err.message : 'Erreur PayPal' }, 500)
      }
    }

    if (path === '/v1/paypal/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code')
      const stateRaw = url.searchParams.get('state')
      const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error')

      let returnBase = ''
      try {
        if (oauthError) throw new Error(oauthError)
        if (!code) throw new Error('Autorisation PayPal annulée')

        const result = await handleOAuthCallback(env, db, { code, stateRaw })
        returnBase = result.returnUrl || ''
        const target = new URL(returnBase || 'https://hazeyy5.github.io/nova-stream/donations.html')
        target.searchParams.set('paypal', 'connected')
        if (result.email) target.searchParams.set('paypalEmail', result.email)
        return redirect(target.toString())
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connexion PayPal échouée'
        const target = new URL(returnBase || 'https://hazeyy5.github.io/nova-stream/donations.html')
        target.searchParams.set('paypal', 'error')
        target.searchParams.set('paypalError', message)
        return redirect(target.toString())
      }
    }

    if (path === '/v1/paypal/disconnect' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }
      const streamerId = String(body?.streamerId ?? '')
      const key = String(body?.key ?? '')
      const settings = await verifyStreamerKey(db, streamerId, key)
      if (!settings) return json({ success: false, message: 'Non autorisé' }, 403)

      await deletePayPalAccount(db, streamerId)
      return json({ success: true })
    }

    if (path === '/v1/paypal/create-order' && request.method === 'POST') {
      if (!paypalConfigured(env)) {
        return json({ success: false, message: 'PayPal non configuré' }, 503)
      }

      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }

      const streamerId = String(body?.streamerId ?? '')
      const donorName = String(body?.donorName ?? 'Anonyme').trim().slice(0, 40)
      const message = String(body?.message ?? '').trim().slice(0, 280)
      const amount = Number(body?.amount)
      const currency = body?.currency === 'USD' ? 'USD' : 'EUR'
      const returnUrl = String(body?.returnUrl ?? '')
      const cancelUrl = String(body?.cancelUrl ?? returnUrl)

      if (!streamerId || !Number.isFinite(amount)) {
        return json({ success: false, message: 'Données invalides' }, 400)
      }

      const settings = await getStreamerById(db, streamerId)
      if (!settings?.enabled) {
        return json({ success: false, message: 'Dons désactivés' }, 403)
      }
      if (amount < settings.minAmount) {
        return json({ success: false, message: `Montant minimum : ${settings.minAmount} ${currency}` }, 400)
      }

      const hasPayPal = await streamerHasPayPal(db, streamerId)
      if (!hasPayPal) {
        return json({
          success: false,
          message: 'Le streamer n\'a pas connecté PayPal — dons indisponibles',
          code: 'PAYPAL_NOT_CONNECTED'
        }, 403)
      }

      const donationId = crypto.randomUUID()
      const createdAt = Date.now()

      await db
        .prepare(`
          INSERT INTO donations (
            id, streamer_id, donor_name, message, amount, currency,
            status, payment_provider, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending_payment', 'paypal', ?)
        `)
        .bind(donationId, streamerId, donorName || 'Anonyme', message, amount, currency, createdAt)
        .run()

      try {
        const order = await createCheckoutOrder(env, db, {
          streamer: settings,
          donation: { id: donationId, amount, currency },
          returnUrl: returnUrl || 'https://hazeyy5.github.io/nova-stream/tip.html?paid=1',
          cancelUrl: cancelUrl || 'https://hazeyy5.github.io/nova-stream/tip.html?cancel=1'
        })

        await db
          .prepare(`UPDATE donations SET payment_ref = ? WHERE id = ?`)
          .bind(order.id, donationId)
          .run()

        return json({
          success: true,
          donationId,
          orderId: order.id,
          clientId: env.PAYPAL_CLIENT_ID?.trim() || ''
        })
      } catch (err) {
        await db.prepare(`UPDATE donations SET status = 'failed' WHERE id = ?`).bind(donationId).run()
        return json({
          success: false,
          message: err instanceof Error ? err.message : 'Création commande PayPal échouée'
        }, 502)
      }
    }

    if (path === '/v1/paypal/capture-order' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }

      const streamerId = String(body?.streamerId ?? '')
      const orderId = String(body?.orderId ?? '')
      const donationId = String(body?.donationId ?? '')

      if (!streamerId || !orderId) {
        return json({ success: false, message: 'Paramètres manquants' }, 400)
      }

      const settings = await getStreamerById(db, streamerId)
      if (!settings?.enabled) {
        return json({ success: false, message: 'Dons désactivés' }, 403)
      }

      try {
        const capture = await captureCheckoutOrder(env, db, streamerId, orderId)
        const resolvedDonationId =
          donationId ||
          capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id ||
          capture.purchase_units?.[0]?.reference_id ||
          ''

        if (resolvedDonationId) {
          const paymentRef = capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId
          await markDonationPaid(db, resolvedDonationId, paymentRef)
        }

        return json({
          success: true,
          donationId: resolvedDonationId,
          thankYouMessage: settings.thankYouMessage,
          status: 'pending_alert'
        })
      } catch (err) {
        return json({
          success: false,
          message: err instanceof Error ? err.message : 'Capture PayPal échouée'
        }, 502)
      }
    }

    if (path === '/v1/webhooks/paypal' && request.method === 'POST') {
      try {
        const event = await verifyAndParseWebhook(env, request)
        if (!event) return json({ success: false, message: 'Webhook non vérifié' }, 400)
        const result = await processWebhookEvent(db, event)
        return json({ success: true, ...result })
      } catch {
        return json({ success: false }, 500)
      }
    }

    if (path === '/v1/streamer' && request.method === 'GET') {
      const streamerId = url.searchParams.get('id')
      const username = url.searchParams.get('username')?.trim()

      const settings = streamerId
        ? await getStreamerById(db, streamerId)
        : username
          ? await getStreamerByUsername(db, username)
          : null

      if (!settings) {
        return json({ success: false, message: 'Chaîne introuvable' }, 404)
      }
      if (!settings.enabled) {
        return json({ success: false, message: 'Les dons ne sont pas activés pour cette chaîne' }, 404)
      }

      return json({
        success: true,
        streamer: {
          streamerId: settings.streamerId,
          username: settings.username,
          displayName: settings.displayName,
          avatarUrl: settings.avatarUrl,
          currency: settings.currency,
          minAmount: settings.minAmount,
          suggestedAmounts: settings.suggestedAmounts,
          pageTitle: settings.pageTitle,
          pageMessage: settings.pageMessage,
          thankYouMessage: settings.thankYouMessage,
          alertDefaultMessage: settings.alertDefaultMessage || settings.thankYouMessage,
          paypalConnected: settings.paypalConnected,
          paypalLegacyMe: !!settings.paypalUsername?.trim()
        }
      })
    }

    if (path === '/v1/register' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }

      const {
        streamerId,
        username,
        displayName,
        avatarUrl,
        donationKey,
        enabled,
        currency,
        minAmount,
        suggestedAmounts,
        pageTitle,
        pageMessage,
        thankYouMessage,
        paypalUsername,
        alertTitle,
        alertDefaultMessage,
        alertMessageTemplate
      } = body ?? {}

      if (!streamerId || !username || !donationKey) {
        return json({ success: false, message: 'Champs requis manquants' }, 400)
      }

      const thanks = thankYouMessage ?? 'Merci pour votre soutien !'
      const now = Date.now()
      const record = {
        streamer_id: String(streamerId),
        username: String(username).toLowerCase(),
        display_name: String(displayName ?? username),
        avatar_url: avatarUrl ?? '',
        donation_key: String(donationKey),
        enabled: enabled !== false ? 1 : 0,
        currency: currency === 'USD' ? 'USD' : 'EUR',
        min_amount: Math.max(1, Number(minAmount) || 1),
        suggested_amounts: JSON.stringify(parseSuggested(suggestedAmounts)),
        page_title: pageTitle ?? '',
        page_message: pageMessage ?? '',
        thank_you_message: thanks,
        alert_title: String(alertTitle ?? 'Don').slice(0, 60),
        alert_default_message: String(alertDefaultMessage ?? thanks).slice(0, 280),
        alert_message_template: String(alertMessageTemplate ?? '{amount} — {message}').slice(0, 200),
        paypal_username: String(paypalUsername ?? '').replace(/^@/, ''),
        updated_at: now
      }

      await db
        .prepare(`
          INSERT INTO streamers (
            streamer_id, username, display_name, avatar_url, donation_key, enabled,
            currency, min_amount, suggested_amounts, page_title, page_message,
            thank_you_message, alert_title, alert_default_message, alert_message_template,
            paypal_username, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(streamer_id) DO UPDATE SET
            username = excluded.username,
            display_name = excluded.display_name,
            avatar_url = excluded.avatar_url,
            donation_key = excluded.donation_key,
            enabled = excluded.enabled,
            currency = excluded.currency,
            min_amount = excluded.min_amount,
            suggested_amounts = excluded.suggested_amounts,
            page_title = excluded.page_title,
            page_message = excluded.page_message,
            thank_you_message = excluded.thank_you_message,
            alert_title = excluded.alert_title,
            alert_default_message = excluded.alert_default_message,
            alert_message_template = excluded.alert_message_template,
            paypal_username = excluded.paypal_username,
            updated_at = excluded.updated_at
        `)
        .bind(
          record.streamer_id,
          record.username,
          record.display_name,
          record.avatar_url,
          record.donation_key,
          record.enabled,
          record.currency,
          record.min_amount,
          record.suggested_amounts,
          record.page_title,
          record.page_message,
          record.thank_you_message,
          record.alert_title,
          record.alert_default_message,
          record.alert_message_template,
          record.paypal_username,
          record.updated_at
        )
        .run()

      return json({ success: true })
    }

    /** Legacy : alerte immédiate + lien PayPal.me (sans vérification paiement). */
    if (path === '/v1/donate' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ success: false, message: 'JSON invalide' }, 400)
      }

      const streamerId = String(body?.streamerId ?? '')
      const donorName = String(body?.donorName ?? 'Anonyme').trim().slice(0, 40)
      const message = String(body?.message ?? '').trim().slice(0, 280)
      const amount = Number(body?.amount)
      const currency = body?.currency === 'USD' ? 'USD' : 'EUR'

      if (!streamerId || !Number.isFinite(amount)) {
        return json({ success: false, message: 'Données invalides' }, 400)
      }

      const settings = await getStreamerById(db, streamerId)
      if (!settings?.enabled) {
        return json({ success: false, message: 'Dons désactivés' }, 403)
      }
      if (amount < settings.minAmount) {
        return json({ success: false, message: `Montant minimum : ${settings.minAmount} ${currency}` }, 400)
      }

      const hasPayPal = await streamerHasPayPal(db, streamerId)
      if (hasPayPal) {
        return json({
          success: false,
          message: 'Utilisez le bouton PayPal pour payer — l\'alerte apparaîtra après confirmation du paiement.',
          code: 'USE_PAYPAL_CHECKOUT'
        }, 400)
      }

      const donationId = crypto.randomUUID()
      const createdAt = Date.now()

      await db
        .prepare(`
          INSERT INTO donations (
            id, streamer_id, donor_name, message, amount, currency,
            status, payment_provider, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending_alert', 'manual', ?)
        `)
        .bind(donationId, streamerId, donorName || 'Anonyme', message, amount, currency, createdAt)
        .run()

      const symbol = currency === 'USD' ? '$' : '€'
      const paymentUrl = legacyPaypalMeUrl(settings, amount, currency)

      return json({
        success: true,
        donationId,
        legacy: true,
        thankYouMessage: settings.thankYouMessage,
        paymentUrl,
        paymentHint: paymentUrl
          ? `Alerte envoyée — finalisez votre don de ${amount}${symbol} via PayPal.me (mode legacy).`
          : `Votre don de ${amount}${symbol} a été enregistré — l'alerte apparaîtra sur le stream.`
      })
    }

    if (path === '/v1/poll' && request.method === 'GET') {
      const streamerId = url.searchParams.get('streamerId')
      const key = url.searchParams.get('key')
      const since = Number(url.searchParams.get('since') ?? 0)

      if (!streamerId || !key) {
        return json({ success: false, message: 'Paramètres manquants' }, 400)
      }

      const settings = await verifyStreamerKey(db, streamerId, key)
      if (!settings) {
        return json({ success: false, message: 'Non autorisé' }, 403)
      }

      const { results } = await db
        .prepare(`
          SELECT * FROM donations
          WHERE streamer_id = ? AND status = 'pending_alert' AND created_at > ?
          ORDER BY created_at ASC
          LIMIT 50
        `)
        .bind(streamerId, since)
        .all()

      const pending = (results ?? []).map(rowToDonation)
      if (pending.length > 0) {
        const now = Date.now()
        for (const d of pending) {
          await db
            .prepare(`UPDATE donations SET status = 'alerted', alerted_at = ? WHERE id = ?`)
            .bind(now, d.id)
            .run()
        }
      }

      return json({ success: true, donations: pending })
    }

    if (path === '/v1/history' && request.method === 'GET') {
      const streamerId = url.searchParams.get('streamerId')
      const key = url.searchParams.get('key')
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 30)))

      if (!streamerId || !key) {
        return json({ success: false, message: 'Paramètres manquants' }, 400)
      }

      const settings = await verifyStreamerKey(db, streamerId, key)
      if (!settings) {
        return json({ success: false, message: 'Non autorisé' }, 403)
      }

      const { results } = await db
        .prepare(`
          SELECT * FROM donations
          WHERE streamer_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `)
        .bind(streamerId, limit)
        .all()

      const donations = (results ?? []).map(rowToDonation)
      const totalRow = await db
        .prepare(`
          SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
          FROM donations
          WHERE streamer_id = ? AND status IN ('alerted', 'pending_alert') AND payment_provider != 'manual'
        `)
        .bind(streamerId)
        .first()

      return json({
        success: true,
        donations,
        stats: {
          count: totalRow?.count ?? 0,
          totalAmount: totalRow?.total ?? 0,
          currency: settings.currency
        }
      })
    }

    return json({ success: false, message: 'Route introuvable' }, 404)
  }
}
