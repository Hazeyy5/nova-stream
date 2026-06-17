/**
 * API relais des dons Nova Stream (Cloudflare Worker + D1).
 * Déploiement : voir README.md
 */

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

function rowToStreamer(row) {
  if (!row) return null
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
    createdAt: row.created_at
  }
}

async function getStreamerById(db, streamerId) {
  const row = await db
    .prepare('SELECT * FROM streamers WHERE streamer_id = ?')
    .bind(streamerId)
    .first()
  return rowToStreamer(row)
}

async function getStreamerByUsername(db, username) {
  const row = await db
    .prepare('SELECT * FROM streamers WHERE username = ? COLLATE NOCASE')
    .bind(String(username).toLowerCase())
    .first()
  return rowToStreamer(row)
}

async function verifyStreamerKey(db, streamerId, key) {
  const s = await getStreamerById(db, streamerId)
  if (!s || s.donationKey !== key) return null
  return s
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
        return json({ ok: true, service: 'nova-donations', storage: 'd1' })
      } catch {
        return json({ ok: false, service: 'nova-donations', storage: 'd1' }, 503)
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
          paypalUsername: settings.paypalUsername
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
      let paymentUrl = ''
      const paypal = settings.paypalUsername?.trim()
      if (paypal) {
        paymentUrl = `https://paypal.me/${encodeURIComponent(paypal)}/${amount}${currency}`
      }

      return json({
        success: true,
        donationId,
        thankYouMessage: settings.thankYouMessage,
        paymentUrl,
        paymentHint: paymentUrl
          ? `Finalisez votre don de ${amount}${symbol} via PayPal pour soutenir ${settings.displayName}.`
          : `Votre don de ${amount}${symbol} a été envoyé — l'alerte apparaîtra sur le stream de ${settings.displayName}.`
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
          FROM donations WHERE streamer_id = ? AND status IN ('alerted', 'paid')
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
